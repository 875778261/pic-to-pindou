/**
 * 应用外壳：宽屏三栏，窄屏画布满屏 + 底部抽屉。
 *
 * 两条路只差布局，内容组件是同一批。
 */

import { useConversion } from './state/store'
import { DropZone } from './ui/DropZone'
import { MobileShell } from './ui/MobileShell'
import { ParameterPane } from './ui/ParameterPane'
import { PreviewStage } from './ui/PreviewStage'
import { CANVAS_PLACEHOLDER } from './ui/statusCopy'
import { UsagePanel } from './ui/UsagePanel'
import { useMediaQuery, WIDE_QUERY } from './ui/useMediaQuery'

function WideShell() {
  const status = useConversion((state) => state.status)
  const pattern = useConversion((state) => state.pattern)
  const source = useConversion((state) => state.source)
  const loadFile = useConversion((state) => state.loadFile)
  const markBlank = useConversion((state) => state.markBlank)

  return (
    <main className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-6 px-5 py-8">
      <header>
        <h1 className="font-semibold text-2xl text-neutral-900">图片转拼豆图纸</h1>
        <p className="mt-1 text-neutral-600 text-sm">
          拖一张图进来，定好尺寸和色号上限，立刻看到摆成拼豆是什么样。
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)_240px]">
        <aside className="flex flex-col gap-4">
          <DropZone
            onFile={(file) => {
              void loadFile(file)
            }}
          />

          <ParameterPane pattern={pattern} source={source} />
        </aside>

        <PreviewStage
          pattern={pattern}
          placeholder={CANVAS_PLACEHOLDER[status]}
          onPickCode={markBlank}
        />

        <UsagePanel pattern={pattern} />
      </div>
    </main>
  )
}

export default function App() {
  const wide = useMediaQuery(WIDE_QUERY)
  return wide ? <WideShell /> : <MobileShell />
}
