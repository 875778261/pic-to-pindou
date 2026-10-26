/**
 * 参数档：图纸摘要、调参控件、导出入口与转换失败的提示。
 *
 * 宽屏是左栏的一摞，窄屏是抽屉里的一档，内容相同。
 */

import type { Pattern } from '../domain/pattern'
import { type SourceInfo, useConversion } from '../state/store'
import { ExportButton } from './ExportButton'
import { ParameterPanel } from './ParameterPanel'
import { PatternSummary } from './PatternSummary'

type ParameterPaneProps = {
  pattern: Pattern | null
  source: SourceInfo | null
}

export function ParameterPane({ pattern, source }: ParameterPaneProps) {
  const status = useConversion((state) => state.status)
  const notice = useConversion((state) => state.notice)

  return (
    <div className="flex flex-col gap-4">
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
    </div>
  )
}
