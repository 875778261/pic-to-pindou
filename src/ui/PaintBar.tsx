/**
 * 画笔条：编辑态下贴在画布下方，一眼看到手里是什么笔、能挑哪个色号。
 *
 * 色板列当前档位的全部色号并按系列分组：手改常是为了加一个原图上没有的颜色。
 */

import { useMemo } from 'react'
import { paletteById } from '../domain/palette/registry'
import type { PaletteEntry } from '../domain/palette/types'
import type { Pattern } from '../domain/pattern'
import { useConversion } from '../state/store'

type PaintBarProps = {
  pattern: Pattern
}

function Swatch({
  entry,
  active,
  onPick,
}: {
  entry: PaletteEntry
  active: boolean
  onPick: (code: string) => void
}) {
  return (
    <button
      type="button"
      aria-label={`画笔 ${entry.code}`}
      aria-pressed={active}
      title={entry.code}
      className={`h-4 w-4 shrink-0 rounded-sm border ${
        active
          ? 'border-neutral-900 ring-2 ring-neutral-900 ring-offset-1'
          : 'border-neutral-300 hover:border-neutral-500'
      }`}
      style={{ backgroundColor: entry.hex }}
      onClick={() => onPick(entry.code)}
    />
  )
}

export function PaintBar({ pattern }: PaintBarProps) {
  const brush = useConversion((state) => state.brush)
  const setBrush = useConversion((state) => state.setBrush)
  const history = useConversion((state) => state.history)
  const undo = useConversion((state) => state.undo)
  const redo = useConversion((state) => state.redo)

  const palette = paletteById(pattern.paletteId)
  const groups = useMemo(() => {
    const bySeries = new Map<string, PaletteEntry[]>()
    for (const entry of palette.entries) {
      const group = bySeries.get(entry.series)
      if (group) {
        group.push(entry)
      } else {
        bySeries.set(entry.series, [entry])
      }
    }
    return [...bySeries]
  }, [palette])

  const currentHex =
    brush.kind === 'code' ? (palette.byCode.get(brush.code)?.hex ?? '#FFFFFF') : null
  const canUndo = (history?.past.length ?? 0) > 0
  const canRedo = (history?.future.length ?? 0) > 0

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="橡皮"
          aria-pressed={brush.kind === 'eraser'}
          className={`rounded-md border px-2 py-1 text-xs ${
            brush.kind === 'eraser'
              ? 'border-neutral-900 bg-neutral-900 text-white'
              : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-500'
          }`}
          onClick={() => setBrush({ kind: 'eraser' })}
        >
          橡皮
        </button>

        <span className="flex items-center gap-1 text-neutral-600 text-xs" aria-live="polite">
          当前
          {currentHex ? (
            <span
              aria-hidden="true"
              className="block h-3 w-3 rounded-sm border border-neutral-300"
              style={{ backgroundColor: currentHex }}
            />
          ) : null}
          <span className="font-medium text-neutral-900 tabular-nums">
            {brush.kind === 'eraser' ? '空白格' : brush.code || '未选色'}
          </span>
        </span>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            aria-label="撤销"
            disabled={!canUndo}
            className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-neutral-700 text-xs hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={undo}
          >
            撤销
          </button>
          <button
            type="button"
            aria-label="重做"
            disabled={!canRedo}
            className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-neutral-700 text-xs hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={redo}
          >
            重做
          </button>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1">
        {groups.map(([series, entries]) => (
          <div key={series} className="flex shrink-0 flex-col gap-1">
            <span className="text-[10px] text-neutral-500">{series}</span>
            <div className="grid grid-flow-col grid-rows-4 gap-1">
              {entries.map((entry) => (
                <Swatch
                  key={entry.code}
                  entry={entry}
                  active={brush.kind === 'code' && brush.code === entry.code}
                  onPick={(code) => setBrush({ kind: 'code', code })}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
