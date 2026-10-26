/**
 * 应用外壳。
 *
 * 这一版打通「上传 → 调参 → 预览 → 导出 PNG 图纸」。
 */

import { type ConvertStatus, useConversion } from './state/store'
import { DropZone } from './ui/DropZone'
import { ExportButton } from './ui/ExportButton'
import { ParameterPanel } from './ui/ParameterPanel'
import { PatternSummary } from './ui/PatternSummary'
import { PreviewStage } from './ui/PreviewStage'

const PLACEHOLDER_BY_STATUS: Record<ConvertStatus, string> = {
  idle: '还没有图片。在左边选一张，或者把图直接拖进来。',
  loading: '正在读图…',
  converting: '正在把图片变成豆格…',
  ready: '预览出问题了，换一张图试试。',
  rejected: '这张图没有转成图纸，原因见左边。',
  failed: '这张图没有转成图纸，原因见左边。',
}

export default function App() {
  const status = useConversion((state) => state.status)
  const pattern = useConversion((state) => state.pattern)
  const source = useConversion((state) => state.source)
  const notice = useConversion((state) => state.notice)
  const loadFile = useConversion((state) => state.loadFile)
  const markBlank = useConversion((state) => state.markBlank)

  return (
    <main className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-6 px-5 py-8">
      <header>
        <h1 className="font-semibold text-2xl text-neutral-900">图片转拼豆图纸</h1>
        <p className="mt-1 text-neutral-600 text-sm">
          拖一张图进来，定好尺寸和色号上限，立刻看到摆成拼豆是什么样。
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-4">
          <DropZone
            onFile={(file) => {
              void loadFile(file)
            }}
          />

          <ParameterPanel />

          {pattern ? <PatternSummary pattern={pattern} source={source} /> : null}

          <ExportButton />

          {notice ? (
            <p
              role="alert"
              className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 text-sm"
            >
              {notice}
            </p>
          ) : null}

          {status === 'ready' && pattern ? (
            <p className="text-neutral-400 text-xs">屏幕颜色和实物有偏差，色号才是下单依据。</p>
          ) : null}
        </aside>

        <PreviewStage
          pattern={pattern}
          placeholder={PLACEHOLDER_BY_STATUS[status]}
          onPickCode={markBlank}
        />
      </div>
    </main>
  )
}
