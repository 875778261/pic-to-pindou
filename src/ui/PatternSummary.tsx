/**
 * 图纸摘要：这张图纸有多少豆格、用了几个色号、一共要摆多少颗、做出来多大。
 */

import { beadSizeById, patternSizeMm } from '../domain/bead-size'
import { totalBeads } from '../domain/grid'
import type { Pattern } from '../domain/pattern'
import { type SourceInfo, useConversion } from '../state/store'

type PatternSummaryProps = {
  pattern: Pattern
  source: SourceInfo | null
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-neutral-500 text-xs">{label}</dt>
      <dd className="mt-0.5 font-semibold text-neutral-900 text-sm">{value}</dd>
    </div>
  )
}

export function PatternSummary({ pattern, source }: PatternSummaryProps) {
  const beadSizeId = useConversion((state) => state.beadSizeId)
  const sizeMm = patternSizeMm(pattern.grid.cols, pattern.grid.rows, beadSizeById(beadSizeId))
  const sizeLabel = `${(sizeMm.widthMm / 10).toFixed(1)} × ${(sizeMm.heightMm / 10).toFixed(1)} cm`

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <dl className="grid grid-cols-2 gap-2">
        <SummaryStat label="豆格" value={`${pattern.grid.cols} × ${pattern.grid.rows}`} />
        <SummaryStat label="色号" value={`${pattern.usedCodes.length} 个`} />
        <SummaryStat label="颗数" value={`${totalBeads(pattern.grid)} 颗`} />
        <SummaryStat label="成品" value={sizeLabel} />
      </dl>

      {source ? (
        <p className="mt-3 truncate border-neutral-100 border-t pt-3 text-neutral-500 text-xs">
          {source.fileName} · 源图 {source.width} × {source.height}
        </p>
      ) : null}
    </div>
  )
}
