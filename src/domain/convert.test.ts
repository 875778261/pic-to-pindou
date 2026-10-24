import { describe, expect, it } from 'vitest'
import { hexToLab, hexToRgb, type Rgb } from './colour'
import { type ConvertedPattern, convert } from './convert'
import { cellAt, totalBeads } from './grid'
import { MARD_221, MARD_291 } from './palette/mard'
import type { BeadCode, Palette } from './palette/types'
import { defaultConvertParams } from './params'
import { type Pattern, paletteEntryForCell } from './pattern'
import type { PixelSource } from './source'

/** 逐像素给色的构造器，纯色、棋盘、条纹都从它拼出来 */
function imageFrom(
  width: number,
  height: number,
  colourAt: (col: number, row: number) => Rgb,
): PixelSource {
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const colour = colourAt(col, row)
      const offset = (row * width + col) * 4
      pixels[offset] = colour.r
      pixels[offset + 1] = colour.g
      pixels[offset + 2] = colour.b
      pixels[offset + 3] = 255
    }
  }
  return { pixels, width, height }
}

function solidImage(width: number, height: number, colour: Rgb): PixelSource {
  return imageFrom(width, height, () => colour)
}

const BLACK: Rgb = { r: 0, g: 0, b: 0 }
const WHITE: Rgb = { r: 255, g: 255, b: 255 }

/** 三通道双色渐变的「照片状」输入：颜色多、有亮暗过渡，用来压量化的约束 */
function gradientImage(width: number, height: number): PixelSource {
  return imageFrom(width, height, (col, row) => ({
    r: Math.round((col / Math.max(1, width - 1)) * 255),
    g: Math.round((row / Math.max(1, height - 1)) * 255),
    b: Math.round(((col + row) / Math.max(1, width + height - 2)) * 255),
  }))
}

function expectConverted(outcome: ReturnType<typeof convert>): asserts outcome is ConvertedPattern {
  if (outcome.status !== 'converted') {
    throw new Error(`预期转换成功，实际被拒：${JSON.stringify(outcome)}`)
  }
}

/** 某格落在哪个色号上；空白格返回 undefined */
function codeAt(
  palette: Palette,
  pattern: Pattern,
  col: number,
  row: number,
): BeadCode | undefined {
  return paletteEntryForCell(palette, cellAt(pattern.grid, col, row))?.code
}

describe('转换管线', () => {
  it('整张图只有一种色卡颜色时，每格都是那个色号', () => {
    const palette = MARD_291
    // 原图颜色与这个豆色完全相同，色差为零，最近色号必然是它自己
    const beadColour = palette.entries[40]
    if (!beadColour) {
      throw new Error('色卡条目缺失，测试数据前提不成立')
    }

    const outcome = convert({
      source: solidImage(87, 87, hexToRgb(beadColour.hex)),
      params: defaultConvertParams(),
      palette,
    })
    expectConverted(outcome)

    const { pattern } = outcome
    expect(pattern.grid.cols).toBe(29)
    expect(pattern.grid.rows).toBe(29)
    expect(pattern.usedCodes).toEqual([beadColour.code])
    expect(totalBeads(pattern.grid)).toBe(29 * 29)
    expect(pattern.counts[beadColour.index]).toBe(29 * 29)
  })

  it('源图恰好是网格整数倍时按最近邻取块首像素，不做面积平均', () => {
    const palette = MARD_291
    // 4 × 4 上是 2 × 2 的黑白方块，压到 2 × 2：面积平均会把四个格子都抹成同一片灰，
    // 最近邻会原样保留方块
    const source = imageFrom(4, 4, (col, row) => (col < 2 === row < 2 ? BLACK : WHITE))

    const outcome = convert({
      source,
      params: defaultConvertParams({ cols: 2, rows: 2 }),
      palette,
    })
    expectConverted(outcome)

    const { pattern } = outcome
    const topLeft = codeAt(palette, pattern, 0, 0)
    const topRight = codeAt(palette, pattern, 1, 0)
    const bottomLeft = codeAt(palette, pattern, 0, 1)
    const bottomRight = codeAt(palette, pattern, 1, 1)

    expect(topLeft).toBe(bottomRight)
    expect(topRight).toBe(bottomLeft)
    expect(topLeft).not.toBe(topRight)
    expect(pattern.usedCodes).toHaveLength(2)
  })

  it('源图不是网格整数倍时按面积平均，格子取所在区域的平均色', () => {
    const palette = MARD_291
    // 100 × 100 上黑下白，压到 1 × 3：中间那行横跨黑白交界，平均出来必须是灰，不是纯黑或纯白
    const source = imageFrom(100, 100, (_col, row) => (row < 50 ? BLACK : WHITE))

    const outcome = convert({
      source,
      params: defaultConvertParams({ cols: 1, rows: 3 }),
      palette,
    })
    expectConverted(outcome)

    const { pattern } = outcome
    const top = codeAt(palette, pattern, 0, 0)
    const middle = codeAt(palette, pattern, 0, 1)
    const bottom = codeAt(palette, pattern, 0, 2)

    expect(top).not.toBe(bottom)
    expect(middle).not.toBe(top)
    expect(middle).not.toBe(bottom)

    // 中间格比上格亮、比下格暗：明确按面积平均混合，且行序自上而下
    const lightness = (code: BeadCode | undefined) => {
      const entry = code ? palette.byCode.get(code) : undefined
      if (!entry) {
        throw new Error(`没拿到色号 ${String(code)} 的豆色`)
      }
      return hexToLab(entry.hex).l
    }
    expect(lightness(middle)).toBeGreaterThan(lightness(top) ?? Number.POSITIVE_INFINITY)
    expect(lightness(middle)).toBeLessThan(lightness(bottom) ?? Number.NEGATIVE_INFINITY)
  })

  it('限色 K=8 时最多用 8 个色号，且每个用到的色号都在色卡里', () => {
    const palette = MARD_291

    const outcome = convert({
      source: gradientImage(120, 90),
      params: defaultConvertParams({ maxColours: 8 }),
      palette,
    })
    expectConverted(outcome)

    const { pattern } = outcome
    expect(pattern.usedCodes.length).toBeLessThanOrEqual(8)
    expect(pattern.usedCodes.length).toBeGreaterThan(1)
    for (const code of pattern.usedCodes) {
      expect(palette.byCode.has(code), code).toBe(true)
    }
    expect(pattern.counts.reduce((sum, value) => sum + value, 0)).toBe(29 * 29)
  })

  it('限色再紧也不产出特种色号，221 档的图纸同样落在标准色内', () => {
    const source = gradientImage(120, 90)

    for (const palette of [MARD_291, MARD_221]) {
      const outcome = convert({
        source,
        params: defaultConvertParams({ paletteId: palette.id, maxColours: 12 }),
        palette,
      })
      expectConverted(outcome)

      for (const code of outcome.pattern.usedCodes) {
        const entry = palette.byCode.get(code)
        expect(entry, `${palette.id} 缺色号 ${code}`).toBeDefined()
        expect(entry?.material, `${code} 是特种色，不该由量化选出`).toBe('standard')
      }
    }
  })

  it('同一张图在相同参数下重复转换，逐格与颗数完全一致', () => {
    const palette = MARD_291
    const params = defaultConvertParams({ maxColours: 16 })

    const first = convert({ source: gradientImage(120, 90), params, palette })
    const second = convert({ source: gradientImage(120, 90), params, palette })
    expectConverted(first)
    expectConverted(second)

    expect(Array.from(second.pattern.grid.cells)).toEqual(Array.from(first.pattern.grid.cells))
    expect(second.pattern.counts).toEqual(first.pattern.counts)
    expect(second.pattern.usedCodes).toEqual(first.pattern.usedCodes)
  })

  it('网格超过 200 × 200 被拒绝，并带上请求值与上限，刚好 200 × 200 仍可转换', () => {
    const palette = MARD_291
    const source = solidImage(40, 40, WHITE)

    const rejected = convert({
      source,
      params: defaultConvertParams({ cols: 201, rows: 200 }),
      palette,
    })
    expect(rejected.status).toBe('rejected')
    if (rejected.status !== 'rejected') {
      throw new Error('预期被拒绝')
    }
    expect(rejected.reason).toBe('grid-too-large')
    expect(rejected.requested).toEqual({ cols: 201, rows: 200 })
    expect(rejected.requestedBeads).toBe(201 * 200)
    expect(rejected.limit).toEqual({ maxCols: 200, maxRows: 200 })

    const accepted = convert({
      source,
      params: defaultConvertParams({ cols: 200, rows: 200 }),
      palette,
    })
    expectConverted(accepted)
    expect(accepted.pattern.grid.cols).toBe(200)
  })

  it('被设为空白的颜色变成空白格，且不计入任何色号的颗数', () => {
    const palette = MARD_291
    const beadColour = palette.entries[120]
    if (!beadColour) {
      throw new Error('色卡条目缺失，测试数据前提不成立')
    }
    // 58 宽压到 29 列正好整数倍：左 14 列刷成空白色，右 15 列是另一个颜色
    const source = imageFrom(58, 58, (col) => (col < 28 ? hexToRgb(beadColour.hex) : WHITE))

    const outcome = convert({
      source,
      params: defaultConvertParams({ blankColours: [beadColour.hex] }),
      palette,
    })
    expectConverted(outcome)

    const { pattern } = outcome
    expect(cellAt(pattern.grid, 0, 0)).toBe(0)
    expect(cellAt(pattern.grid, 28, 0)).not.toBe(0)
    expect(totalBeads(pattern.grid)).toBe(15 * 29)
    expect(pattern.counts.reduce((sum, value) => sum + value, 0)).toBe(15 * 29)
  })

  it('全图都被设为空白时给出全空白图纸，不报错', () => {
    const palette = MARD_291
    const beadColour = palette.entries[0]
    if (!beadColour) {
      throw new Error('色卡条目缺失，测试数据前提不成立')
    }

    const outcome = convert({
      source: solidImage(29, 29, hexToRgb(beadColour.hex)),
      params: defaultConvertParams({ blankColours: [beadColour.hex] }),
      palette,
    })
    expectConverted(outcome)

    expect(outcome.pattern.usedCodes).toEqual([])
    expect(totalBeads(outcome.pattern.grid)).toBe(0)
  })

  it('开抖动后仍然确定、仍然不超过限色数', () => {
    const palette = MARD_291
    const params = defaultConvertParams({ dither: true, maxColours: 8 })

    const first = convert({ source: gradientImage(120, 90), params, palette })
    const second = convert({ source: gradientImage(120, 90), params, palette })
    expectConverted(first)
    expectConverted(second)

    expect(Array.from(second.pattern.grid.cells)).toEqual(Array.from(first.pattern.grid.cells))
    expect(first.pattern.usedCodes.length).toBeLessThanOrEqual(8)
  })

  it('亮度拉到最大时整张图落到同一个颜色上，说明预处理确实生效', () => {
    const palette = MARD_291
    const outcome = convert({
      source: gradientImage(120, 90),
      params: defaultConvertParams({ brightness: 100 }),
      palette,
    })
    expectConverted(outcome)
    expect(outcome.pattern.usedCodes).toHaveLength(1)
  })
})
