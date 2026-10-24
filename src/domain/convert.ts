/**
 * 转换管线：源图像素 + 参数 → 图纸。
 *
 * 整条管线只有这一个对外接口，也是唯一的测试接缝：界面、Worker、渲染都只认它的结果，
 * 中间步骤不进测试。
 */

import { adjustColours } from './adjust'
import { hexToRgb, packRgb } from './colour'
import { createBlankGrid } from './grid'
import type { Palette } from './palette/types'
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

  const sampled = sampleToGrid(source.pixels, source.width, source.height, params.cols, params.rows)
  const adjusted = adjustColours(sampled.colours, params)

  const blankSet = new Set<number>(params.blankColours.map((hex) => packRgb(hexToRgb(hex))))
  const paintable = adjusted.filter((colour) => !blankSet.has(packRgb(colour)))

  const grid = createBlankGrid(params.cols, params.rows)
  if (paintable.length > 0) {
    const medoids = selectMedoids(palette, paintable, params.maxColours)
    const indexes = params.dither
      ? mapColoursWithDither(palette, medoids, adjusted, params.cols, params.rows)
      : mapColours(palette, medoids, adjusted)

    for (let cell = 0; cell < adjusted.length; cell += 1) {
      const colour = adjusted[cell]
      if (!colour || blankSet.has(packRgb(colour))) {
        continue
      }
      grid.cells[cell] = (indexes[cell] ?? 0) + 1
    }
  }

  return { status: 'converted', pattern: createPattern(palette, grid) }
}
