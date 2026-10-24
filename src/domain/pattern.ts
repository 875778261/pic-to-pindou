/**
 * 图纸。
 *
 * 网格只存色卡下标，脱离档位就说不清指向哪个色号：291 档的图纸拿给 221 档读会越界。
 */

import { type BeadGrid, BLANK_CELL, countBeads } from './grid'
import type { BeadCode, Palette, PaletteEntry } from './palette/types'

export type Pattern = {
  /** 这张图纸用的是哪个色卡档位 */
  paletteId: string
  grid: BeadGrid
  /** 各色号的颗数，下标与色卡下标对齐 */
  counts: number[]
  /** 实际用到的色号，按色卡下标升序，与 counts 的非零项一一对应 */
  usedCodes: BeadCode[]
}

/** 由网格与它所属的色卡推出完整图纸，颗数与色号不会和网格脱节 */
export function createPattern(palette: Palette, grid: BeadGrid): Pattern {
  const counts = countBeads(grid, palette.entries.length)
  const usedCodes = palette.entries
    .filter((entry) => (counts[entry.index] ?? 0) > 0)
    .map((entry) => entry.code)

  return { paletteId: palette.id, grid, counts, usedCodes }
}

/** 图纸是不是这张色卡画的。错配会让下标越界或指向别的豆色，必须拦住 */
export function patternBelongsTo(pattern: Pattern, palette: Palette): boolean {
  return pattern.paletteId === palette.id
}

/** 某格指向的色卡条目；空白格给出 undefined */
export function paletteEntryForCell(palette: Palette, cell: number): PaletteEntry | undefined {
  return cell === BLANK_CELL ? undefined : palette.entries[cell - 1]
}
