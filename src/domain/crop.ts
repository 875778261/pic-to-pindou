/**
 * 裁切：把原图居中裁成与网格同比例的一块。
 *
 * 裁哪一维、裁掉多少只在这里算一次。面板上「裁掉百分之几」与采样真正用的区域必须同源，
 * 各算一份迟早会对不上，用户看到的百分比就和实际剪掉的画面不符。
 */

import type { ConvertFit } from './params'

export type ImageSize = { width: number; height: number }

/** 源图上真正参与采样的矩形 */
export type SourceRegion = { x: number; y: number; width: number; height: number }

function assertSize(source: ImageSize): void {
  if (!Number.isFinite(source.width) || !Number.isFinite(source.height)) {
    throw new Error(`源图尺寸非法：${source.width} × ${source.height}`)
  }
  if (source.width <= 0 || source.height <= 0) {
    throw new Error(`源图尺寸非法：${source.width} × ${source.height}`)
  }
}

/** 源图上参与采样的区域；铺满时就是整张图 */
export function cropRegion(
  source: ImageSize,
  cols: number,
  rows: number,
  fit: ConvertFit,
): SourceRegion {
  assertSize(source)
  const whole = { x: 0, y: 0, width: source.width, height: source.height }
  if (fit === 'fill') {
    return whole
  }

  const targetRatio = cols / rows
  const sourceRatio = source.width / source.height

  if (targetRatio > sourceRatio) {
    // 网格比原图更宽：宽度铺满，上下各裁一半
    const keptHeight = Math.min(source.height, Math.max(1, Math.round(source.width / targetRatio)))
    return {
      x: 0,
      y: Math.floor((source.height - keptHeight) / 2),
      width: source.width,
      height: keptHeight,
    }
  }
  if (targetRatio < sourceRatio) {
    // 网格比原图更高：高度铺满，左右各裁一半
    const keptWidth = Math.min(source.width, Math.max(1, Math.round(source.height * targetRatio)))
    return {
      x: Math.floor((source.width - keptWidth) / 2),
      y: 0,
      width: keptWidth,
      height: source.height,
    }
  }
  return whole
}

/** 被剪掉的画面占原图多大比例（按面积），供面板明示裁掉多少 */
export function cropShare(cols: number, rows: number, source: ImageSize): number {
  const region = cropRegion(source, cols, rows, 'crop')
  return 1 - (region.width * region.height) / (source.width * source.height)
}
