/**
 * 预览台：把画布摆到能放下的最大整数格宽。
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { paletteById } from '../domain/palette/registry'
import type { Pattern } from '../domain/pattern'
import { drawFlatPreview } from '../render/flatPreview'

type PreviewStageProps = {
  pattern: Pattern | null
  placeholder: string
}

export function PreviewStage({ pattern, placeholder }: PreviewStageProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) {
      return
    }
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect) {
        setViewport({ width: rect.width, height: rect.height })
      }
    })
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  const palette = useMemo(() => (pattern ? paletteById(pattern.paletteId) : null), [pattern])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !pattern || !palette) {
      return
    }
    drawFlatPreview(canvas, pattern, palette, {
      width: viewport.width,
      height: viewport.height,
      pixelRatio: window.devicePixelRatio || 1,
    })
  }, [pattern, palette, viewport])

  return (
    <div
      ref={stageRef}
      className="flex min-h-[420px] items-center justify-center overflow-hidden rounded-xl border border-neutral-200 bg-white p-4"
    >
      {pattern ? (
        <canvas ref={canvasRef} className="shadow-sm ring-1 ring-neutral-200" />
      ) : (
        <p className="max-w-xs text-center text-neutral-400 text-sm">{placeholder}</p>
      )}
    </div>
  )
}
