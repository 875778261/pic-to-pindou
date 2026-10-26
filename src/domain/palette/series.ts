/**
 * 色号所属的系列。
 *
 * 系列取色号的前缀字母；标准系列是 MARD 221 档覆盖的 A–M，其余一律算特种色（ADR-0006）。
 */

export type BeadMaterial = 'standard' | 'special'

/** 221 标准档覆盖的系列。MARD 若新增标准系列，改这一处 */
const STANDARD_SERIES: ReadonlySet<string> = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'M'])

export function seriesOf(code: string): string {
  const matched = /^[A-Z]+/.exec(code.toUpperCase())
  if (!matched) {
    throw new Error(`色号缺少系列前缀：${code}`)
  }
  return matched[0]
}

export function materialOf(code: string): BeadMaterial {
  return STANDARD_SERIES.has(seriesOf(code)) ? 'standard' : 'special'
}
