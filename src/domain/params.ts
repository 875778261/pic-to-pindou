/**
 * 转换参数。
 *
 * 豆规格刻意不在其中：它只是成品尺寸的换算常数，同一张图纸在三种规格下网格数据通用。
 * paletteId 必须在其中：网格只存色卡下标，换了档位下标就会指到别的豆色甚至越界。
 */

import { DEFAULT_PALETTE_ID } from './palette/registry'

/** 网格单边上限。200 × 200 = 40000 颗，是用户真会去摆的量，再往上应该分图 */
export const MAX_GRID_SIDE = 200

/** 一块 29 × 29 拼豆板 */
export const PEGBOARD_SIDE = 29

export type ConvertParams = {
  /** 221 标准档 / 291 全系档 */
  paletteId: string
  cols: number
  rows: number
  /** 最多用几个色号，K */
  maxColours: number
  /** 误差扩散抖动。默认关闭：会产出零散色点，可能要为一格开一包豆 */
  dither: boolean
  /**
   * 被当作空白格的颜色，sRGB hex。
   * 比对的是预处理之后的颜色，也就是预览里看到的那个颜色。
   */
  blankColours: string[]
  /** -100 ~ 100，0 为原图 */
  brightness: number
  /** 0 ~ 2，1 为原图 */
  contrast: number
  /** 0 ~ 2，1 为原图 */
  saturation: number
}

/** #3 的固定默认参数：一块板、最多 16 色、抖动关闭、不调色 */
export function defaultConvertParams(overrides: Partial<ConvertParams> = {}): ConvertParams {
  return {
    paletteId: DEFAULT_PALETTE_ID,
    cols: PEGBOARD_SIDE,
    rows: PEGBOARD_SIDE,
    maxColours: 16,
    dither: false,
    blankColours: [],
    brightness: 0,
    contrast: 1,
    saturation: 1,
    ...overrides,
  }
}
