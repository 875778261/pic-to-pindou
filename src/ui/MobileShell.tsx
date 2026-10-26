/**
 * 窄屏外壳：画布满屏，参数、用量、图片收进底部抽屉。
 *
 * 三档是「看什么」不是「去哪」：切档不动画布、不清空任何状态，画布始终在底下。
 */

import { type ReactNode, useState } from 'react'
import { paletteById } from '../domain/palette/registry'
import type { Pattern } from '../domain/pattern'
import { useConversion } from '../state/store'
import { DropZone } from './DropZone'
import { PaintBar } from './PaintBar'
import { ParameterPane } from './ParameterPane'
import { PreviewStage } from './PreviewStage'
import { CANVAS_PLACEHOLDER } from './statusCopy'
import { UsagePanel } from './UsagePanel'

type PaneId = 'params' | 'usage' | 'source'

const PANES: readonly { id: PaneId; label: string }[] = [
  { id: 'params', label: '参数' },
  { id: 'usage', label: '用量' },
  { id: 'source', label: '图片' },
]

/** 画笔徽标：显示当前手里是什么笔，点一下展开参数档挑色 */
function BrushBadge({ pattern, onOpen }: { pattern: Pattern; onOpen: () => void }) {
  const brush = useConversion((state) => state.brush)
  const hex =
    brush.kind === 'code' ? paletteById(pattern.paletteId).byCode.get(brush.code)?.hex : null

  return (
    <button
      type="button"
      aria-label="打开画笔"
      className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full border border-neutral-200 bg-white/95 px-3 py-1.5 text-xs shadow-md"
      onClick={onOpen}
    >
      {hex ? (
        <span
          aria-hidden="true"
          className="block h-3.5 w-3.5 rounded-sm border border-neutral-300"
          style={{ backgroundColor: hex }}
        />
      ) : null}
      <span className="font-medium text-neutral-900 tabular-nums">
        {brush.kind === 'eraser' ? '橡皮' : brush.code || '选色'}
      </span>
    </button>
  )
}

export function MobileShell() {
  const status = useConversion((state) => state.status)
  const pattern = useConversion((state) => state.pattern)
  const source = useConversion((state) => state.source)
  const loadFile = useConversion((state) => state.loadFile)
  const markBlank = useConversion((state) => state.markBlank)
  const editing = useConversion((state) => state.paintMode) === 'edit'

  const [pane, setPane] = useState<PaneId | null>(null)

  const openPane = PANES.find((item) => item.id === pane)
  const canPaint = editing && pattern !== null

  // 三档都留在 DOM 里，只用 hidden 换挡：切档不卸载组件，输入框里的半截内容与导出进度才不会丢
  const panes: readonly { id: PaneId; content: ReactNode }[] = [
    {
      id: 'params',
      content: (
        <div className="flex flex-col gap-4">
          {canPaint && pattern ? <PaintBar pattern={pattern} /> : null}
          <ParameterPane pattern={pattern} source={source} />
        </div>
      ),
    },
    { id: 'usage', content: <UsagePanel pattern={pattern} /> },
    {
      id: 'source',
      content: (
        <div className="flex flex-col gap-3">
          <DropZone
            onFile={(file) => {
              void loadFile(file)
            }}
          />
          <p className="text-neutral-500 text-xs">
            {source
              ? `当前：${source.fileName} · 源图 ${source.width} × ${source.height}`
              : '还没有选图。选一张之后，画布上立刻出图纸。'}
          </p>
          <p className="text-neutral-400 text-xs">图片不会离开这台设备，也不会传到任何服务器。</p>
        </div>
      ),
    },
  ]

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-neutral-50">
      <header className="shrink-0 px-4 pt-3 pb-1">
        <h1 className="font-semibold text-base text-neutral-900">图片转拼豆图纸</h1>
      </header>

      <div className="relative grid min-h-0 flex-1 grid-rows-1 px-2 pb-2">
        <PreviewStage
          pattern={pattern}
          placeholder={CANVAS_PLACEHOLDER[status]}
          onPickCode={markBlank}
          fill
        />

        {canPaint && pattern ? (
          <BrushBadge pattern={pattern} onOpen={() => setPane('params')} />
        ) : null}
      </div>

      <section
        aria-label={pane ? `${openPane?.label ?? ''}抽屉` : '抽屉'}
        hidden={pane === null}
        className="shrink-0 max-h-[58%] overflow-y-auto overscroll-contain rounded-t-2xl border-neutral-200 border-t bg-white p-4 shadow-[0_-8px_24px_rgba(0,0,0,0.10)]"
      >
        {panes.map((item) => (
          <div key={item.id} hidden={pane !== item.id}>
            {item.content}
          </div>
        ))}
      </section>

      <nav
        aria-label="面板切换"
        className="shrink-0 border-neutral-200 border-t bg-white pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-3">
          {PANES.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={pane === item.id}
              className={`py-3 text-xs ${
                pane === item.id ? 'font-medium text-neutral-900' : 'text-neutral-500'
              }`}
              onClick={() => setPane((current) => (current === item.id ? null : item.id))}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
