/**
 * 采样：把源图压到网格分辨率，每格得到一个颜色。
 *
 * 面积平均为主。像素画的放大倍率通常就是整数，这时面积平均会把硬边缘糊成中间色，
 * 所以源图尺寸接近目标网格整数倍时切最近邻。
 */

import type { Rgb } from './colour'
import { cropRegion, type SourceRegion } from './crop'
import type { ConvertFit } from './params'

export type SampledGrid = {
  cols: number
  rows: number
  /** 长度恒为 cols × rows，按行优先排列，三通道取整到 0–255 */
  colours: Rgb[]
}

/** 源图边长与目标格数之比离整数多近才算「接近整数倍」 */
const NEAR_MULTIPLE_TOLERANCE = 0.02

function isNearIntegerMultiple(ratio: number): boolean {
  return Math.abs(ratio - Math.round(ratio)) <= NEAR_MULTIPLE_TOLERANCE
}

export function usesNearestNeighbour(
  width: number,
  height: number,
  cols: number,
  rows: number,
): boolean {
  return isNearIntegerMultiple(width / cols) && isNearIntegerMultiple(height / rows)
}

type WeightedSpan = { pixel: number; weight: number }

/** 目标格在源图上覆盖到哪些像素，各占多少比例 */
function spansFor(sourceLength: number, targetLength: number, offset: number): WeightedSpan[][] {
  const spans: WeightedSpan[][] = []
  for (let target = 0; target < targetLength; target += 1) {
    const start = (target * sourceLength) / targetLength
    const end = ((target + 1) * sourceLength) / targetLength
    const cellSpans: WeightedSpan[] = []
    for (let pixel = Math.floor(start); pixel < Math.ceil(end); pixel += 1) {
      const weight = Math.min(end, pixel + 1) - Math.max(start, pixel)
      if (weight > 0) {
        cellSpans.push({ pixel: offset + pixel, weight })
      }
    }
    spans.push(cellSpans)
  }
  return spans
}

function sampleNearest(
  pixels: Uint8ClampedArray,
  width: number,
  region: SourceRegion,
  cols: number,
  rows: number,
): SampledGrid {
  const colours: Rgb[] = new Array(cols * rows)
  for (let row = 0; row < rows; row += 1) {
    const sourceRow =
      region.y + Math.min(region.height - 1, Math.floor((row * region.height) / rows))
    for (let col = 0; col < cols; col += 1) {
      const sourceCol =
        region.x + Math.min(region.width - 1, Math.floor((col * region.width) / cols))
      const offset = (sourceRow * width + sourceCol) * 4
      colours[row * cols + col] = {
        r: pixels[offset] ?? 0,
        g: pixels[offset + 1] ?? 0,
        b: pixels[offset + 2] ?? 0,
      }
    }
  }
  return { cols, rows, colours }
}

function sampleAreaAverage(
  pixels: Uint8ClampedArray,
  width: number,
  region: SourceRegion,
  cols: number,
  rows: number,
): SampledGrid {
  const columnSpans = spansFor(region.width, cols, region.x)
  const rowSpans = spansFor(region.height, rows, region.y)
  const colours: Rgb[] = new Array(cols * rows)

  for (let row = 0; row < rows; row += 1) {
    const rowSpan = rowSpans[row] ?? []
    for (let col = 0; col < cols; col += 1) {
      const columnSpan = columnSpans[col] ?? []
      let red = 0
      let green = 0
      let blue = 0
      let totalWeight = 0

      for (const rowPart of rowSpan) {
        const rowOffset = rowPart.pixel * width
        for (const columnPart of columnSpan) {
          const weight = rowPart.weight * columnPart.weight
          const offset = (rowOffset + columnPart.pixel) * 4
          red += (pixels[offset] ?? 0) * weight
          green += (pixels[offset + 1] ?? 0) * weight
          blue += (pixels[offset + 2] ?? 0) * weight
          totalWeight += weight
        }
      }

      colours[row * cols + col] =
        totalWeight > 0
          ? {
              r: Math.round(red / totalWeight),
              g: Math.round(green / totalWeight),
              b: Math.round(blue / totalWeight),
            }
          : { r: 0, g: 0, b: 0 }
    }
  }

  return { cols, rows, colours }
}

export function sampleToGrid(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  cols: number,
  rows: number,
  fit: ConvertFit = 'fill',
): SampledGrid {
  if (width <= 0 || height <= 0) {
    throw new Error(`源图尺寸非法：${width} × ${height}`)
  }
  if (pixels.length < width * height * 4) {
    throw new Error(`像素数据不足：期望 ${width * height * 4}，实际 ${pixels.length}`)
  }

  const region = cropRegion({ width, height }, cols, rows, fit)
  return usesNearestNeighbour(region.width, region.height, cols, rows)
    ? sampleNearest(pixels, width, region, cols, rows)
    : sampleAreaAverage(pixels, width, region, cols, rows)
}
