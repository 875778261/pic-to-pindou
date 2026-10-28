/**
 * 导出按钮。
 *
 * 只负责按下、交给导出层、再把结果说给用户听；图纸长什么样不在这里定。
 * 尺寸与体积在点之前就报出来：用户该在文件落盘前知道这张有多大（ADR-0017）。
 */

import { useMemo, useState } from 'react'
import { beadSizeById } from '../domain/bead-size'
import { paletteById } from '../domain/palette/registry'
import { exportPatternSheet } from '../export/downloadPng'
import { planPatternSheet } from '../export/drawPattern'
import { estimateSheetBytes } from '../export/estimate'
import { EXPORT_LIMITS, SAFE_LIMITS } from '../export/layout'
import { useConversion } from '../state/store'

type ExportPhase = 'idle' | 'working' | 'done' | 'failed'

function formatBytes(bytes: number): string {
  const megabytes = bytes / 1024 / 1024
  return megabytes >= 1 ? `${Math.round(megabytes)} MB` : `${Math.round(bytes / 1024)} KB`
}

/** 体积是估的，给区间；上下界落成同一个数时不摆两个一样的数字 */
function formatByteRange(low: number, high: number): string {
  const lowText = formatBytes(low)
  const highText = formatBytes(high)
  return lowText === highText ? `约 ${lowText}` : `约 ${lowText}–${highText}`
}

export function ExportButton() {
  const pattern = useConversion((state) => state.pattern)
  const source = useConversion((state) => state.source)
  const beadSizeId = useConversion((state) => state.beadSizeId)
  const [phase, setPhase] = useState<ExportPhase>('idle')
  const [message, setMessage] = useState<string | null>(null)

  const plan = useMemo(() => {
    if (!pattern) {
      return null
    }
    const input = {
      pattern,
      palette: paletteById(pattern.paletteId),
      beadSize: beadSizeById(beadSizeId),
    }
    const primary = planPatternSheet(input)
    const area = primary.layout.canvas.width * primary.layout.canvas.height
    // 只在这张图确实超过安全预算时才多排一次：预告里要给手机上那次降级报个具体数
    const safe = area > SAFE_LIMITS.maxCanvasArea ? planPatternSheet(input, SAFE_LIMITS) : null
    return { input, primary, safe }
  }, [pattern, beadSizeId])

  const handleClick = async () => {
    if (!plan || phase === 'working') {
      return
    }
    setPhase('working')
    setMessage(null)
    try {
      const result = await exportPatternSheet(plan.input, source?.fileName ?? '拼豆图纸')
      setPhase('done')
      const labelNote = result.labelled
        ? '格内已标色号'
        : '图纸过大，格内未标色号，按行列坐标配图例摆'
      const sizeNote = `（${result.width} × ${result.height} 像素，${result.cellSize} 像素/颗）`
      const degradeNote = result.degraded
        ? `；${EXPORT_LIMITS.cellSize} 像素在这台设备上画不出来，已降级`
        : ''
      setMessage(`已生成 ${result.fileName}${sizeNote}${degradeNote}，${labelNote}`)
    } catch (error) {
      setPhase('failed')
      setMessage(error instanceof Error ? error.message : '导出失败，请再试一次')
    }
  }

  const estimate = plan ? estimateSheetBytes(plan.primary.layout) : null

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

      {plan && estimate ? (
        <>
          <p className="mt-2 text-neutral-500 text-xs">
            将导出 {plan.primary.layout.canvas.width} × {plan.primary.layout.canvas.height} 像素，
            {formatByteRange(estimate.low, estimate.high)}；每颗豆 {plan.primary.layout.cellSize}{' '}
            像素。
          </p>
          {plan.safe ? (
            <p className="mt-1 text-amber-700 text-xs">
              这张超过了手机画布上限：手机上可能画不出来，会自动降到 {plan.safe.layout.cellSize}{' '}
              像素/颗。
            </p>
          ) : null}
        </>
      ) : (
        <p className="mt-2 text-neutral-500 text-xs">先上传一张图，才有图纸可导。</p>
      )}

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
