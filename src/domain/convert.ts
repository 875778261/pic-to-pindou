/**
 * 转换管线：源图像素 + 参数 → 图纸。
 *
 * 整条管线只有这一个对外接口，也是唯一的测试接缝：界面、Worker、渲染都只认它的结果，
 * 中间步骤不进测试。
 */

import { adjustColours } from './adjust'
import type { Rgb } from './colour'
import { createBlankGrid } from './grid'
import type { BeadCode, Palette } from './palette/types'
import { type ConvertParams, MAX_GRID_SIDE } from './params'
import { createPattern, type Pattern } from './pattern'
import { mapColours, mapColoursWithDither, selectMedoids } from './quantise'
import { sampleToGrid } from './sample'
import type { PixelSource } from './source'

export type ConvertInput = {
  source: PixelSource
  params: ConvertParams
  /** 由 params.paletteId 解析而来，必须与之一致，否则网格下标会指错豆色 */
  palette: Palette
}

export type ConvertedPattern = { status: 'converted'; pattern: Pattern }

/**
 * 网格超过上限是可预期的拒绝，不是异常：界面要据此说明原因并建议分图，
 * 所以这里给出请求值与上限，文案留给界面。
 */
export type RejectedConversion = {
  status: 'rejected'
  reason: 'grid-too-large'
  requested: { cols: number; rows: number }
  limit: { maxCols: number; maxRows: number }
  /** 请求的网格一共多少颗，界面用它告诉用户超了多少 */
  requestedBeads: number
}

export type ConvertOutcome = ConvertedPattern | RejectedConversion

function assertParams(params: ConvertParams, palette: Palette): void {
  if (params.paletteId !== palette.id) {
    throw new Error(`参数里的档位与色卡不一致：${params.paletteId} ≠ ${palette.id}`)
  }
  if (!Number.isInteger(params.cols) || params.cols < 1) {
    throw new Error(`网格列数必须是正整数：${params.cols}`)
  }
  if (!Number.isInteger(params.rows) || params.rows < 1) {
    throw new Error(`网格行数必须是正整数：${params.rows}`)
  }
  if (!Number.isInteger(params.maxColours) || params.maxColours < 1) {
    throw new Error(`限色数必须是正整数：${params.maxColours}`)
  }
}

/**
 * 量化一遍：在没被标成空白的格上选色，再把每格映射到选中的色号。
 * 返回各格的色卡下标，空洞留给空白格。excludedCodes 为空表示这一遍不排除任何色号。
 */
function assignColours(
  palette: Palette,
  params: ConvertParams,
  colours: readonly Rgb[],
  excludedCodes: ReadonlySet<BeadCode> | undefined,
  blankMask: Uint8Array | null,
): number[] {
  const paintable = blankMask ? colours.filter((_, cell) => !blankMask[cell]) : colours
  if (paintable.length === 0) {
    return []
  }
  const medoids = selectMedoids(palette, paintable, params.maxColours, excludedCodes)
  if (medoids.length === 0) {
    return []
  }
  return params.dither
    ? mapColoursWithDither(palette, medoids, colours, params.cols, params.rows, blankMask)
    : mapColours(palette, medoids, colours)
}

/**
 * 哪些格是空白色号：按未标空白的量化结果认，落在被标色号上的格就是用户点的那种豆。
 * 认完之后再量化第二遍，让空白色号腾出的名额回到剩下的画面上（ADR-0010）。
 */
function blankMaskFor(
  palette: Palette,
  indexes: readonly number[],
  blankCodes: ReadonlySet<BeadCode>,
): Uint8Array | null {
  if (blankCodes.size === 0) {
    return null
  }
  const mask = new Uint8Array(indexes.length)
  let masked = 0
  for (let cell = 0; cell < indexes.length; cell += 1) {
    const index = indexes[cell]
    if (index === undefined) {
      continue
    }
    const entry = palette.entries[index]
    if (entry && blankCodes.has(entry.code)) {
      mask[cell] = 1
      masked += 1
    }
  }
  return masked > 0 ? mask : null
}

export function convert(input: ConvertInput): ConvertOutcome {
  const { source, params, palette } = input
  assertParams(params, palette)

  if (params.cols > MAX_GRID_SIDE || params.rows > MAX_GRID_SIDE) {
    return {
      status: 'rejected',
      reason: 'grid-too-large',
      requested: { cols: params.cols, rows: params.rows },
      limit: { maxCols: MAX_GRID_SIDE, maxRows: MAX_GRID_SIDE },
      requestedBeads: params.cols * params.rows,
    }
  }

  const sampled = sampleToGrid(
    source.pixels,
    source.width,
    source.height,
    params.cols,
    params.rows,
    params.fit,
  )
  const adjusted = adjustColours(sampled.colours, params)

  // 色卡里没有的色号直接忽略：它说的不是这个档位里的颜色
  const blankCodes = new Set<BeadCode>(params.blankCodes.filter((code) => palette.byCode.has(code)))

  let indexes = assignColours(palette, params, adjusted, undefined, null)
  let blankMask: Uint8Array | null = null
  const recognized = blankMaskFor(palette, indexes, blankCodes)
  if (recognized) {
    blankMask = recognized
    indexes = assignColours(palette, params, adjusted, blankCodes, blankMask)
  }

  const grid = createBlankGrid(params.cols, params.rows)
  for (let cell = 0; cell < adjusted.length; cell += 1) {
    if (blankMask?.[cell]) {
      continue
    }
    const index = indexes[cell]
    if (index === undefined) {
      continue
    }
    grid.cells[cell] = index + 1
  }

  return { status: 'converted', pattern: createPattern(palette, grid) }
}
