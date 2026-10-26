/**
 * 预览台：豆形 / 扁平两套画法共用一份视口摆放，画布上可缩放、平移、双击回到适应窗口。
 *
 * 查看态点一下豆是把那个色号标成不摆豆；编辑态落笔涂色，按住空格才挪画布（ADR-0013）。
 */

import { type PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cellPath, paintGrid } from '../domain/edit'
import { BLANK_CELL, cellAt, cellIndex } from '../domain/grid'
import { paletteById } from '../domain/palette/registry'
import { createPattern, type Pattern, paletteEntryForCell } from '../domain/pattern'
import {
  cellAtPoint,
  fitView,
  type Pinch,
  type PreviewStyle,
  panBy,
  pinchView,
  placement,
  type Viewport,
  zoomAt,
} from '../domain/viewport'
import { drawPreview } from '../render/preview'
import { useConversion } from '../state/store'
import { PaintBar } from './PaintBar'

type PreviewStageProps = {
  pattern: Pattern | null
  placeholder: string
  onPickCode: (code: string) => void
  /** 占满给定高度、不写底部操作提示：窄屏上空间要留给画布（#9） */
  fill?: boolean
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

/** 一笔涂色：这次按下到抬起中途划过的格，最后一起记成一步撤销 */
type Stroke = {
  paints: Map<number, number>
  last: { col: number; row: number }
  /** 落笔前那张图纸，用来撤掉「其实是想双指」时误落的那一格 */
  before: Pattern
  /** 已经划过格：划过才算真的在涂，没划过就只是按了一下 */
  moved: boolean
}

/** 屏幕上还按着的指头，按 pointerId 记住位置。两根在一起就是双指手势 */
type PointerSpot = { x: number; y: number }

function pinchOf(pointers: Map<number, PointerSpot>): Pinch | null {
  const [first, second] = [...pointers.values()]
  if (!first || !second) {
    return null
  }
  return {
    centre: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
    distance: Math.hypot(second.x - first.x, second.y - first.y),
  }
}

export function PreviewStage({
  pattern,
  placeholder,
  onPickCode,
  fill = false,
}: PreviewStageProps) {
  const observerRef = useRef<ResizeObserver | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [style, setStyle] = useState<PreviewStyle>('bead')
  const [view, setView] = useState<Viewport>(EMPTY_VIEW)
  const [degraded, setDegraded] = useState(false)
  const [spaceHeld, setSpaceHeld] = useState(false)
  const pickTimerRef = useRef<number | null>(null)
  const dragRef = useRef<{ x: number; y: number; from: Viewport; moved: boolean } | null>(null)
  const strokeRef = useRef<Stroke | null>(null)
  const pointersRef = useRef(new Map<number, PointerSpot>())
  const pinchRef = useRef<Pinch | null>(null)

  const paintMode = useConversion((state) => state.paintMode)
  const brush = useConversion((state) => state.brush)
  const setPaintMode = useConversion((state) => state.setPaintMode)
  const paintDraft = useConversion((state) => state.paintDraft)
  const commitPaint = useConversion((state) => state.commitPaint)
  const undo = useConversion((state) => state.undo)
  const redo = useConversion((state) => state.redo)
  const status = useConversion((state) => state.status)
  const pendingDiscard = useConversion((state) => state.pendingDiscard)
  const confirmDiscard = useConversion((state) => state.confirmDiscard)
  const cancelDiscard = useConversion((state) => state.cancelDiscard)

  const editing = paintMode === 'edit'
  // 图纸还在算、或者正问着要不要丢手改时不落笔：这时的改动会被下一次重算整个盖掉
  const paintable = status === 'ready' && pendingDiscard === null

  // 卸载时清掉还没落地的点选
  useEffect(
    () => () => {
      if (pickTimerRef.current !== null) {
        window.clearTimeout(pickTimerRef.current)
      }
    },
    [],
  )

  // 空格按下时拖动是挪画布，松开又归画笔；撤销快捷键也在这里
  useEffect(() => {
    const isTyping = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !isTyping(event.target)) {
        event.preventDefault()
        setSpaceHeld(true)
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        if (isTyping(event.target)) {
          return
        }
        event.preventDefault()
        if (event.shiftKey) {
          redo()
        } else {
          undo()
        }
      }
    }
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        setSpaceHeld(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [undo, redo])

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

  /** 指针落在画布上的位置 */
  const canvasPoint = (event: PointerEvent<HTMLCanvasElement>): PointerSpot => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  /** 指针落在哪一格；落在网格外给 null */
  const cellUnderPointer = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!pattern) {
      return null
    }
    const point = canvasPoint(event)
    return cellAtPoint(placement(view), point.x, point.y, pattern.grid.cols, pattern.grid.rows)
  }

  /** 手里这支笔画下去是哪个格值：编码 0 是橡皮，色号取色卡下标加一 */
  const brushValue = (): number | null => {
    if (!palette) {
      return null
    }
    if (brush.kind === 'eraser') {
      return BLANK_CELL
    }
    const entry = palette.byCode.get(brush.code)
    return entry ? entry.index + 1 : null
  }

  /** 指针底下那一格该落什么值；指针在网格外、或在手里没笔时给 null */
  const paintHit = (event: PointerEvent<HTMLCanvasElement>) => {
    const point = cellUnderPointer(event)
    const value = brushValue()
    if (!point || value === null || !pattern) {
      return null
    }
    return { point, value, index: cellIndex(pattern.grid, point.col, point.row) }
  }

  /** 把这一笔已经划过的格整体重画一遍图纸 */
  const flushStroke = () => {
    const stroke = strokeRef.current
    // 当前图纸从 store 取：一笔之内闭包里那张可能还没跟上
    const current = useConversion.getState().pattern
    if (!stroke || !current) {
      return
    }
    const nextGrid = paintGrid(
      current.grid,
      [...stroke.paints].map(([index, value]) => ({ index, value })),
    )
    if (nextGrid === current.grid) {
      return
    }
    paintDraft(createPattern(paletteById(current.paletteId), nextGrid))
  }

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    pointersRef.current.set(event.pointerId, canvasPoint(event))

    // 第二根指头落下即转入双指。第一根指头那一下算不算涂：划过格才算，
    // 只按了一下就是本想双指缩放，那一格当场撤掉、不进撤销栈
    if (pointersRef.current.size === 2) {
      const stroke = strokeRef.current
      strokeRef.current = null
      if (stroke?.moved) {
        commitPaint()
      } else if (stroke) {
        paintDraft(stroke.before)
      }
      dragRef.current = null
      pinchRef.current = pinchOf(pointersRef.current)
      return
    }
    if (pointersRef.current.size > 2) {
      return
    }

    if (editing && paintable && !spaceHeld && event.button === 0) {
      const hit = paintHit(event)
      const before = useConversion.getState().pattern
      if (!hit || !before) {
        return
      }
      strokeRef.current = {
        paints: new Map([[hit.index, hit.value]]),
        last: hit.point,
        before,
        moved: false,
      }
      flushStroke()
      return
    }

    dragRef.current = { x: event.clientX, y: event.clientY, from: view, moved: false }
  }

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (pointersRef.current.has(event.pointerId)) {
      pointersRef.current.set(event.pointerId, canvasPoint(event))
    }

    const pinch = pinchRef.current
    if (pinch && pointersRef.current.size >= 2) {
      const next = pinchOf(pointersRef.current)
      if (next) {
        setView((current) => pinchView(current, pinch, next))
        pinchRef.current = next
      }
      return
    }
    // 双指还没全抬起来时，剩下的指头不接着涂也不接着挪
    if (pinchRef.current) {
      return
    }

    const stroke = strokeRef.current
    if (stroke) {
      const hit = paintHit(event)
      if (!hit || !pattern) {
        return
      }
      if (hit.point.col === stroke.last.col && hit.point.row === stroke.last.row) {
        return
      }
      // 指针走快了会跳过中间的格，补齐才不会漏涂
      for (const index of cellPath(pattern.grid, stroke.last, hit.point)) {
        stroke.paints.set(index, hit.value)
      }
      stroke.last = hit.point
      stroke.moved = true
      flushStroke()
      return
    }

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

  /** 放开一根指头；还有指头按着时返回 true */
  const releasePointer = (pointerId: number) => {
    pointersRef.current.delete(pointerId)
    if (pointersRef.current.size === 0) {
      pinchRef.current = null
      return false
    }
    return true
  }

  const handlePointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    const stillHeld = releasePointer(event.pointerId)
    // 双指里先抬起一根：剩下那根不接管成单指动作，等它一起抬
    if (stillHeld && pinchRef.current) {
      return
    }

    if (strokeRef.current) {
      strokeRef.current = null
      // 一次按下到抬起只记一步
      commitPaint()
      return
    }

    const drag = dragRef.current
    dragRef.current = null
    if (!drag || drag.moved || !pattern || !palette || editing) {
      return
    }
    const point = cellUnderPointer(event)
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

  const cursor = editing ? (spaceHeld ? 'cursor-grab' : 'cursor-crosshair') : 'cursor-grab'

  return (
    <div
      className={`flex flex-col gap-2 overflow-hidden rounded-xl border border-neutral-200 bg-white p-4 ${
        fill ? 'min-h-0' : 'min-h-[420px]'
      }`}
    >
      {pattern ? (
        <>
          <div ref={attachSurface} className="relative min-h-0 flex-1">
            <canvas
              ref={attachCanvas}
              aria-label={
                editing
                  ? '图纸预览，编辑中：拖动涂色，按住空格拖动平移'
                  : '图纸预览，可缩放平移；点一颗豆把它标成不摆豆'
              }
              className={`absolute inset-0 touch-none ${cursor}`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={(event) => {
                releasePointer(event.pointerId)
                dragRef.current = null
                // 已经落到图纸上的那一笔照样算一步，不留在半空
                if (strokeRef.current) {
                  strokeRef.current = null
                  commitPaint()
                }
              }}
              onDoubleClick={editing ? undefined : handleDoubleClick}
            />

            <div className="absolute top-2 right-2 flex items-center gap-2">
              {degraded ? (
                <span className="rounded-md bg-neutral-900/75 px-2 py-1 text-[10px] text-white">
                  格太小，已自动用扁平
                </span>
              ) : null}
              <button
                type="button"
                aria-label="回到适应窗口"
                title="回到适应窗口"
                className="rounded-md border border-neutral-200 bg-white/90 px-2 py-1 text-neutral-700 text-xs hover:border-neutral-400"
                onClick={() => setView((current) => fitView(current))}
              >
                适应
              </button>
              <button
                type="button"
                aria-label="切换编辑态"
                aria-pressed={editing}
                className={`rounded-md border px-2 py-1 text-xs ${
                  editing
                    ? 'border-neutral-900 bg-neutral-900 text-white'
                    : 'border-neutral-200 bg-white/90 text-neutral-700 hover:border-neutral-400'
                }`}
                onClick={() => setPaintMode(editing ? 'view' : 'edit')}
              >
                {editing ? '编辑中' : '编辑'}
              </button>
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

            {pendingDiscard !== null ? (
              <div
                role="alertdialog"
                aria-label="重算会丢弃手改"
                className="absolute top-2 left-1/2 flex -translate-x-1/2 flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 shadow-lg"
              >
                <p className="text-amber-900 text-xs">重算会丢弃 {pendingDiscard} 处手改。</p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-amber-300 bg-white px-2 py-1 text-amber-900 text-xs hover:border-amber-500"
                    onClick={cancelDiscard}
                  >
                    放弃改动
                  </button>
                  <button
                    type="button"
                    className="rounded-md bg-neutral-900 px-2 py-1 text-white text-xs hover:bg-neutral-800"
                    onClick={confirmDiscard}
                  >
                    继续重算
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          {editing && !fill ? <PaintBar pattern={pattern} /> : null}
          {fill ? null : (
            <p className="text-neutral-500 text-xs">
              {editing
                ? '拖动涂色、按住空格拖动平移；一笔算一步，撤销在画笔条右侧。手改不保存，刷新就没了。'
                : '滚轮缩放、拖动平移、双击回到适应窗口；点一颗豆把它标成不摆豆。'}
            </p>
          )}{' '}
        </>
      ) : (
        <p className="flex flex-1 items-center justify-center text-center text-neutral-400 text-sm">
          {placeholder}
        </p>
      )}
    </div>
  )
}
