/**
 * 预处理：亮度、对比度、饱和度。
 *
 * 三项都是逐通道的仿射变换，作用在采样后的颜色上与作用在原始像素上等价，
 * 所以放在采样之后做，不必碰原始像素。
 */

import { clampToByte, type Rgb } from './colour'
import type { ConvertParams } from './params'

/** Rec. 709 亮度权重，与 sRGB 主原色一致 */
const LUMA_RED = 0.2126
const LUMA_GREEN = 0.7152
const LUMA_BLUE = 0.0722

export type ColourAdjustments = Pick<ConvertParams, 'brightness' | 'contrast' | 'saturation'>

export function applyColourAdjustments(cell: Rgb, adjustments: ColourAdjustments): Rgb {
  const { brightness, contrast, saturation } = adjustments
  const offset = brightness * 2.55
  const luma = LUMA_RED * cell.r + LUMA_GREEN * cell.g + LUMA_BLUE * cell.b

  const adjustChannel = (channel: number) => {
    const saturated = luma + (channel - luma) * saturation
    return clampToByte((saturated - 128) * contrast + 128 + offset)
  }

  return { r: adjustChannel(cell.r), g: adjustChannel(cell.g), b: adjustChannel(cell.b) }
}

export function adjustColours(colours: readonly Rgb[], adjustments: ColourAdjustments): Rgb[] {
  const isNeutral =
    adjustments.brightness === 0 && adjustments.contrast === 1 && adjustments.saturation === 1
  return isNeutral ? [...colours] : colours.map((cell) => applyColourAdjustments(cell, adjustments))
}
