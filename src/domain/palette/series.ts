/**
 * 色号所属的系列。
 *
 * 系列取色号的前缀字母；标准系列是 MARD 221 档覆盖的 A–M，其余一律算特种色（ADR-0006）。
 */

export type BeadMaterial = 'standard' | 'special'

/** 221 标准档覆盖的系列。MARD 若新增标准系列，改这一处 */
const STANDARD_SERIES: ReadonlySet<string> = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'M'])

/** 只有语义证得住的系列才给中文标签；P、R、Q、T、Y 上游没给定义，只出字母 */
const SERIES_LABELS: Readonly<Record<string, string>> = {
  A: '黄橙',
  B: '红粉',
  C: '蓝青',
  D: '绿色',
  E: '紫色',
  F: '棕咖',
  G: '黑白灰',
  H: '荧光',
  M: '过渡',
  ZG: '珠光',
}

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

export function seriesLabel(series: string): string | undefined {
  return SERIES_LABELS[series]
}

/** 界面上给用户看的系列名：有中文就带上，没有就只显示字母 */
export function seriesDisplayName(series: string): string {
  const label = seriesLabel(series)
  return label ? `${series} ${label}` : series
}
