/**
 * 预览台：把画布摆到能放下的最大整数格宽。
 *
 * 画布可点：点到哪一颗豆，就把那颗豆的色号交出去，由上层标成不摆豆。
 */

import { type MouseEvent, useEffect, useMemo, useRef, useState } from 'react'
import { cellAt } from '../domain/grid'
import { paletteById } from '../domain/palette/registry'
import { type Pattern, paletteEntryForCell } from '../domain/pattern'
import { drawFlatPreview } from '../render/flatPreview'

type PreviewStageProps = {
  pattern: Pattern | null
  placeholder: string
  onPickCode: (code: string) => void
}

export function PreviewStage({ pattern, placeholder, onPickCode }: PreviewStageProps) {
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

  const handleClick = (event: MouseEvent<HTMLCanvasElement>) => {
    if (!pattern || !palette) {
      return
    }
    // 画布按整数格宽等比缩放，所以点击位置除以显示尺寸就是第几格
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) {
      return
    }
    const col = Math.floor(((event.clientX - rect.left) / rect.width) * pattern.grid.cols)
    const row = Math.floor(((event.clientY - rect.top) / rect.height) * pattern.grid.rows)
    if (col < 0 || col >= pattern.grid.cols || row < 0 || row >= pattern.grid.rows) {
      return
    }
    const entry = paletteEntryForCell(palette, cellAt(pattern.grid, col, row))
    if (entry) {
      onPickCode(entry.code)
    }
  }

  return (
    <div
      ref={stageRef}
      className="flex min-h-[420px] flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-neutral-200 bg-white p-4"
    >
      {pattern ? (
        <>
          <canvas
            ref={canvasRef}
            aria-label="图纸预览，点任意一颗豆把它标成不摆豆"
            className="cursor-crosshair shadow-sm ring-1 ring-neutral-200"
            onClick={handleClick}
          />
          <p className="text-neutral-500 text-xs">
            点任意一颗豆，把它标成不摆豆；取消在参数面板的「空白色号」里。
          </p>
        </>
      ) : (
        <p className="max-w-xs text-center text-neutral-400 text-sm">{placeholder}</p>
      )}
    </div>
  )
}
