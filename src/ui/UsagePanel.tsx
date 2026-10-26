/**
 * 用量面板：按颗数从多到少列出用到的每个色号，拿它决定先买哪几包。
 *
 * 条目与排序直接取导出图例那一份 `legendEntries()`，不另算一遍（ADR-0008、ADR-0012）。
 * 下单看色号，色块只是屏幕近似（ADR-0009）。
 */

import { useMemo } from 'react'
import { paletteById } from '../domain/palette/registry'
import { type LegendEntry, legendEntries, type Pattern } from '../domain/pattern'
import { type ConvertStatus, useConversion } from '../state/store'

/** 还没有条目时的说明；转不出图纸的原因由 store 的提示代答，界面不重写一份 */
const PENDING_TEXT: Record<'idle' | 'loading' | 'converting' | 'ready', string> = {
  idle: '还没有图纸。转出一张之后，这里按颗数从多到少列出每个色号。',
  loading: '正在读图…',
  converting: '正在算用量…',
  ready: '这张图纸一颗豆都没摆，用量是空的。',
}

type UsagePanelProps = {
  pattern: Pattern | null
}

function hasPendingText(status: ConvertStatus): status is keyof typeof PENDING_TEXT {
  return status in PENDING_TEXT
}

function UsageRow({ entry }: { entry: LegendEntry }) {
  return (
    <li className="flex items-center gap-2 py-1.5">
      <span
        aria-hidden="true"
        className="block h-4 w-4 shrink-0 rounded-sm border border-neutral-300"
        style={{ backgroundColor: entry.hex }}
      />
      <span className="font-medium text-neutral-900 text-xs tabular-nums">{entry.code}</span>
      <span className="ml-auto text-neutral-600 text-xs tabular-nums">{entry.count} 颗</span>
    </li>
  )
}

export function UsagePanel({ pattern }: UsagePanelProps) {
  const status = useConversion((state) => state.status)
  const notice = useConversion((state) => state.notice)
  const palette = useMemo(() => (pattern ? paletteById(pattern.paletteId) : null), [pattern])
  const entries = useMemo(
    () => (pattern && palette ? legendEntries(pattern, palette) : []),
    [pattern, palette],
  )

  // 转换中不列条目（ADR-0012）
  const listedEntries = status === 'ready' ? entries : []
  const emptyText = hasPendingText(status)
    ? PENDING_TEXT[status]
    : (notice ?? '这张图没有转成图纸。')

  return (
    <section
      aria-label="用量面板"
      className="flex min-h-0 flex-col self-start rounded-xl border border-neutral-200 bg-white p-4"
    >
      <h2 className="font-semibold text-neutral-900 text-sm">用量</h2>

      {listedEntries.length > 0 ? (
        <ul className="mt-1 max-h-96 divide-y divide-neutral-100 overflow-y-auto pr-1 lg:max-h-[30rem]">
          {listedEntries.map((entry) => (
            <UsageRow key={entry.code} entry={entry} />
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-neutral-400 text-xs">{emptyText}</p>
      )}
    </section>
  )
}
