/**
 * 豆规格。
 *
 * 豆规格只是物理尺寸的换算常数，不参与转换：同一张图纸在三种规格下网格数据完全通用，
 * 换规格变的只是成品边长。
 */

export type BeadSizeId = 'mini' | 'standard' | 'large'

export type BeadSize = {
  id: BeadSizeId
  /** 界面上给用户看的叫法 */
  label: string
  diameterMm: number
}

export const BEAD_SIZES: readonly BeadSize[] = [
  { id: 'mini', label: '迷你', diameterMm: 2.6 },
  { id: 'standard', label: '标准', diameterMm: 5 },
  { id: 'large', label: '大号', diameterMm: 10 },
]

export function beadSizeById(id: BeadSizeId): BeadSize {
  const found = BEAD_SIZES.find((size) => size.id === id)
  if (!found) {
    throw new Error(`未知的豆规格：${id}`)
  }
  return found
}

export type PatternSizeMm = { widthMm: number; heightMm: number }

/** 成品边长 = 该边豆格数 × 豆规格 */
export function patternSizeMm(cols: number, rows: number, beadSize: BeadSize): PatternSizeMm {
  if (!Number.isFinite(beadSize.diameterMm) || beadSize.diameterMm <= 0) {
    throw new Error(`豆规格必须为正数：${beadSize.diameterMm}`)
  }
  return { widthMm: cols * beadSize.diameterMm, heightMm: rows * beadSize.diameterMm }
}
