/**
 * 图纸。
 *
 * 网格只存色卡下标，脱离档位就说不清指向哪个色号：291 档的图纸拿给 221 档读会越界。
 */

import { type BeadGrid, BLANK_CELL, countBeads } from './grid'
import type { BeadCode, Palette, PaletteEntry } from './palette/types'

/**
 * 格内塞得下色号的最小格宽。
 * 再窄字号就掉到 6px 以下，印在纸上认不出（ADR-0015）。
 */
export const MIN_CODE_CELL_SIZE = 14

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

/** 图例里的一行。色号是唯一标识：MARD 没有官方色名，系列也没有可证的语义（ADR-0009） */
export type LegendEntry = {
  code: BeadCode
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
          count,
          hex: entry.hex,
          index: entry.index,
        },
      ]
    })
    .sort((left, right) => right.count - left.count || left.index - right.index)
    .map(({ index: _index, ...entry }) => entry)
}

/**
 * 这个格宽塞不塞得下色号。
 * 只存在这一处：排版、绘制、界面提示都问它，不再各拿格数猜一遍（ADR-0015）。
 */
export function cellFitsCode(cellSize: number): boolean {
  return cellSize >= MIN_CODE_CELL_SIZE
}
