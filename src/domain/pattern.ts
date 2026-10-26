/**
 * 图纸。
 *
 * 网格只存色卡下标，脱离档位就说不清指向哪个色号：291 档的图纸拿给 221 档读会越界。
 */

import { type BeadGrid, BLANK_CELL, countBeads } from './grid'
import { seriesDisplayName } from './palette/series'
import type { BeadCode, Palette, PaletteEntry } from './palette/types'

/**
 * 单边到这个格数为止，格子里还塞得下色号。
 * 再大就只能靠行列坐标配图例认格。
 */
export const LABELLED_CELL_LIMIT = 40

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

/** 图例里的一行 */
export type LegendEntry = {
  code: BeadCode
  /** 名称取系列名：MARD 没有官方色名，编一个只会误导（ADR-0005） */
  name: string
  count: number
  hex: string
}

/**
 * 图例条目，按颗数降序。
 * 同颗数按色卡顺序排，同一张图纸每次导出的图例顺序才固定。
 */
export function legendEntries(pattern: Pattern, palette: Palette): LegendEntry[] {
  if (!patternBelongsTo(pattern, palette)) {
    throw new Error(`图纸属于色卡 ${pattern.paletteId}，不能拿 ${palette.id} 出图例`)
  }
  return palette.entries
    .flatMap((entry) => {
      const count = pattern.counts[entry.index] ?? 0
      if (count <= 0) {
        return []
      }
      return [
        {
          code: entry.code,
          name: seriesDisplayName(entry.series),
          count,
          hex: entry.hex,
          index: entry.index,
        },
      ]
    })
    .sort((left, right) => right.count - left.count || left.index - right.index)
    .map(({ index: _index, ...entry }) => entry)
}

/** 格内要不要标色号。取长短边的长者：任一维过密，格子就都塞不下了 */
export function labelsCellCodes(cols: number, rows: number): boolean {
  return Math.max(cols, rows) <= LABELLED_CELL_LIMIT
}
