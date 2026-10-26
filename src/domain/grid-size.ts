/**
 * 网格尺寸推导。
 *
 * 尺寸有两个来源：板数预设（整块板拼起来的定值）与自由输入。
 * 比例锁定打开时用户只改一边，另一边按原图宽高比推出来——网格比例与原图相符，
 * 既不用裁切也不会变形（ADR-0007）。
 */

import type { ImageSize } from './crop'
import { PEGBOARD_SIDE } from './params'

export type GridPreset = {
  id: string
  /** 界面上给用户看的叫法：几个 29×29 的板 */
  label: string
  cols: number
  rows: number
}

export const GRID_PRESETS: readonly GridPreset[] = [
  { id: '1', label: '1 块', cols: PEGBOARD_SIDE, rows: PEGBOARD_SIDE },
  { id: '2', label: '2 块', cols: PEGBOARD_SIDE, rows: PEGBOARD_SIDE * 2 },
  { id: '4', label: '4 块', cols: PEGBOARD_SIDE * 2, rows: PEGBOARD_SIDE * 2 },
  { id: '9', label: '9 块', cols: PEGBOARD_SIDE * 3, rows: PEGBOARD_SIDE * 3 },
]

function aspectOf(source: ImageSize): number {
  if (!Number.isFinite(source.width) || !Number.isFinite(source.height)) {
    throw new Error(`源图尺寸非法：${source.width} × ${source.height}`)
  }
  if (source.width <= 0 || source.height <= 0) {
    throw new Error(`源图尺寸非法：${source.width} × ${source.height}`)
  }
  return source.width / source.height
}

/** 给定列数，按原图宽高比推出行数 */
export function rowsForCols(cols: number, source: ImageSize): number {
  return Math.max(1, Math.round(cols / aspectOf(source)))
}

/** 给定行数，按原图宽高比推出列数 */
export function colsForRows(rows: number, source: ImageSize): number {
  return Math.max(1, Math.round(rows * aspectOf(source)))
}
