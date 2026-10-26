/**
 * 导出按钮。
 *
 * 只负责按下、交给导出层、再把结果说给用户听；图纸长什么样不在这里定。
 */

import { useState } from 'react'
import { beadSizeById } from '../domain/bead-size'
import { paletteById } from '../domain/palette/registry'
import { LABELLED_CELL_LIMIT, labelsCellCodes } from '../domain/pattern'
import { exportPatternSheet } from '../export/downloadPng'
import { useConversion } from '../state/store'

type ExportPhase = 'idle' | 'working' | 'done' | 'failed'

export function ExportButton() {
  const pattern = useConversion((state) => state.pattern)
  const source = useConversion((state) => state.source)
  const beadSizeId = useConversion((state) => state.beadSizeId)
  const [phase, setPhase] = useState<ExportPhase>('idle')
  const [message, setMessage] = useState<string | null>(null)

  const labelled = pattern ? labelsCellCodes(pattern.grid.cols, pattern.grid.rows) : false

  const handleClick = async () => {
    if (!pattern || phase === 'working') {
      return
    }
    setPhase('working')
    setMessage(null)
    try {
      const result = await exportPatternSheet(
        { pattern, palette: paletteById(pattern.paletteId), beadSize: beadSizeById(beadSizeId) },
        source?.fileName ?? '拼豆图纸',
      )
      setPhase('done')
      setMessage(`已生成 ${result.fileName}（${result.width} × ${result.height} 像素）`)
    } catch (error) {
      setPhase('failed')
      setMessage(error instanceof Error ? error.message : '导出失败，请再试一次')
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <button
        type="button"
        className="w-full rounded-lg bg-neutral-900 px-4 py-2 font-medium text-sm text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
        disabled={!pattern || phase === 'working'}
        onClick={() => {
          void handleClick()
        }}
      >
        {phase === 'working' ? '正在生成图纸…' : '导出 PNG 图纸'}
      </button>

      <p className="mt-2 text-neutral-500 text-xs">
        {pattern
          ? labelled
            ? '图纸含网格、行列坐标、图例、成品尺寸与总颗数，格内直接标色号。'
            : `网格单边超过 ${LABELLED_CELL_LIMIT} 格，格内不标色号，按行列坐标配图例摆。`
          : '先上传一张图，才有图纸可导。'}
      </p>

      {message ? (
        <p
          role="status"
          className={`mt-1 text-xs ${phase === 'failed' ? 'text-amber-700' : 'text-neutral-500'}`}
        >
          {message}
        </p>
      ) : null}
    </div>
  )
}
