/**
 * 预览台：豆形 / 扁平两套画法共用一份视口摆放，画布上可缩放、平移、双击回到适应窗口。
 *
 * 点一下（没有拖动）仍然是把那颗豆的色号交出去，标成不摆豆。
 */

import { type PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cellAt } from '../domain/grid'
import { paletteById } from '../domain/palette/registry'
import { type Pattern, paletteEntryForCell } from '../domain/pattern'
import {
  cellAtPoint,
  fitView,
  type PreviewStyle,
  panBy,
  placement,
  type Viewport,
  zoomAt,
} from '../domain/viewport'
import { drawPreview } from '../render/preview'

type PreviewStageProps = {
  pattern: Pattern | null
  placeholder: string
  onPickCode: (code: string) => void
}

/** 按下到抬起移动超过这个距离就算拖动，不再当成点选 */
const DRAG_THRESHOLD_PX = 3

/** 滚轮一下到一格的缩放系数 */
const WHEEL_ZOOM_RATE = 0.0015

/** 点选要等这么久才落地，留出双击的判定窗口 */
const DOUBLE_CLICK_GUARD_MS = 220

const EMPTY_VIEW: Viewport = {
  cols: 1,
  rows: 1,
  width: 0,
  height: 0,
  zoom: 1,
  panX: 0,
  panY: 0,
}

export function PreviewStage({ pattern, placeholder, onPickCode }: PreviewStageProps) {
  const observerRef = useRef<ResizeObserver | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [style, setStyle] = useState<PreviewStyle>('bead')
  const [view, setView] = useState<Viewport>(EMPTY_VIEW)
  const [degraded, setDegraded] = useState(false)
  const pickTimerRef = useRef<number | null>(null)
  const dragRef = useRef<{ x: number; y: number; from: Viewport; moved: boolean } | null>(null)

  // 卸载时清掉还没落地的点选
  useEffect(
    () => () => {
      if (pickTimerRef.current !== null) {
        window.clearTimeout(pickTimerRef.current)
      }
    },
    [],
  )

  // 量的是承载区而不是画布本身：画布绝对定位铺满它，尺寸只由布局决定
  const attachSurface = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect()
    observerRef.current = null
    if (!node) {
      return
    }
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect) {
        setSize({ width: rect.width, height: rect.height })
      }
    })
    observer.observe(node)
    observerRef.current = observer
  }, [])

  // 换图或改尺寸时回到适应窗口，同尺寸下重算只更新画布大小，不动用户的缩放
  useEffect(() => {
    if (!pattern) {
      return
    }
    const { cols, rows } = pattern.grid
    setView((current) =>
      current.cols === cols && current.rows === rows
        ? { ...current, width: size.width, height: size.height }
        : { cols, rows, width: size.width, height: size.height, zoom: 1, panX: 0, panY: 0 },
    )
  }, [pattern, size])

  const palette = useMemo(() => (pattern ? paletteById(pattern.paletteId) : null), [pattern])

  /** 滚轮缩放，锚在指针位置；用函数式更新，处理器本身不需要依赖 view */
  const handleWheelRef = useRef((event: WheelEvent) => {
    event.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const rect = canvas.getBoundingClientRect()
    const factor = Math.exp(-event.deltaY * WHEEL_ZOOM_RATE)
    setView((current) =>
      zoomAt(current, { x: event.clientX - rect.left, y: event.clientY - rect.top }, factor),
    )
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !pattern || !palette || view.width <= 0 || view.height <= 0) {
      return
    }
    const drawn = drawPreview(canvas, {
      pattern,
      palette,
      style,
      view,
      pixelRatio: window.devicePixelRatio || 1,
    })
    // 只有降级与否变化时才回报，拖动平移不应每帧多一次渲染
    const next = style === 'bead' && drawn.drawnWith === 'flat'
    setDegraded((current) => (current === next ? current : next))
  }, [pattern, palette, style, view])

  // 滚轮要拦掉页面滚动，React 的 wheel 监听是被动的，只能自己挂一个非被动监听；
  // 画布要到出图之后才挂载，所以用 callback ref 在挂载当下就挂上
  const attachCanvas = useCallback((node: HTMLCanvasElement | null) => {
    const previous = canvasRef.current
    if (previous) {
      previous.removeEventListener('wheel', handleWheelRef.current)
    }
    canvasRef.current = node
    if (node) {
      node.addEventListener('wheel', handleWheelRef.current, { passive: false })
    }
  }, [])

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { x: event.clientX, y: event.clientY, from: view, moved: false }
  }

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current
    if (!drag) {
      return
    }
    const deltaX = event.clientX - drag.x
    const deltaY = event.clientY - drag.y
    if (!drag.moved && Math.hypot(deltaX, deltaY) <= DRAG_THRESHOLD_PX) {
      return
    }
    drag.moved = true
    setView(panBy(drag.from, deltaX, deltaY))
  }

  const handlePointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag || drag.moved || !pattern || !palette) {
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    const point = cellAtPoint(
      placement(view),
      event.clientX - rect.left,
      event.clientY - rect.top,
      pattern.grid.cols,
      pattern.grid.rows,
    )
    if (!point) {
      return
    }
    const entry = paletteEntryForCell(palette, cellAt(pattern.grid, point.col, point.row))
    if (!entry) {
      return
    }
    // 双击回适应窗口的第一次点击也会走到这里：点选延后落地，双击到达时撤掉待办
    const code = entry.code
    if (pickTimerRef.current !== null) {
      window.clearTimeout(pickTimerRef.current)
    }
    pickTimerRef.current = window.setTimeout(() => {
      pickTimerRef.current = null
      onPickCode(code)
    }, DOUBLE_CLICK_GUARD_MS)
  }

  const handleDoubleClick = () => {
    if (pickTimerRef.current !== null) {
      window.clearTimeout(pickTimerRef.current)
      pickTimerRef.current = null
    }
    setView((current) => fitView(current))
  }

  return (
    <div className="flex min-h-[420px] flex-col gap-2 overflow-hidden rounded-xl border border-neutral-200 bg-white p-4">
      {pattern ? (
        <>
          <div ref={attachSurface} className="relative min-h-0 flex-1">
            <canvas
              ref={attachCanvas}
              aria-label="图纸预览，可缩放平移；点一颗豆把它标成不摆豆"
              className="absolute inset-0 cursor-crosshair touch-none"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={() => {
                dragRef.current = null
              }}
              onDoubleClick={handleDoubleClick}
            />

            <div className="absolute top-2 right-2 flex items-center gap-2">
              {degraded ? (
                <span className="rounded-md bg-neutral-900/75 px-2 py-1 text-[10px] text-white">
                  格太小，已自动用扁平
                </span>
              ) : null}
              <button
                type="button"
                aria-label="切换画法"
                aria-pressed={style === 'bead'}
                disabled={degraded}
                title={degraded ? '格太小，放大之后会自动用豆形' : undefined}
                className={`rounded-md border px-2 py-1 text-xs ${
                  style === 'bead'
                    ? 'border-neutral-900 bg-neutral-900 text-white'
                    : 'border-neutral-200 bg-white/90 text-neutral-700 hover:border-neutral-400'
                } ${degraded ? 'cursor-not-allowed opacity-60' : ''}`}
                onClick={() => setStyle((current) => (current === 'bead' ? 'flat' : 'bead'))}
              >
                {style === 'bead' ? '豆形' : '扁平'}
              </button>
            </div>
          </div>

          <p className="text-neutral-500 text-xs">
            滚轮缩放、拖动平移、双击回到适应窗口；点一颗豆把它标成不摆豆。
          </p>
        </>
      ) : (
        <p className="flex flex-1 items-center justify-center text-center text-neutral-400 text-sm">
          {placeholder}
        </p>
      )}
    </div>
  )
}
