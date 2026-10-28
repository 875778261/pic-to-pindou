/**
 * 导出体积的估算。
 *
 * 只给区间：同一张排版在不同用色数、是否抖动下熵差很大，估一个精确值只会骗人。
 * 系数来自真实导出样张的实测区间，取保守的上下界。
 */

import type { ExportLayout } from './layout'

export const ESTIMATE_BYTES_PER_PIXEL = { low: 0.065, high: 0.15 } as const

export function estimateSheetBytes(layout: ExportLayout): { low: number; high: number } {
  const pixels = layout.canvas.width * layout.canvas.height
  return {
    low: Math.round(pixels * ESTIMATE_BYTES_PER_PIXEL.low),
    high: Math.round(pixels * ESTIMATE_BYTES_PER_PIXEL.high),
  }
}
