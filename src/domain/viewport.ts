/**
 * 预览视口：把网格摆到画布上，管适应窗口、缩放、平移与格的取点。
 *
 * 豆形与扁平两套画法共用这一份摆放：坐标只在这里算一次，绘制层照着画（ADR-0003）。
 */

/** 预览的两种画法 */
export type PreviewStyle = 'bead' | 'flat'

/** 单格边长到这个数豆形才分辨得出豆身与豆孔 */
export const BEAD_MIN_CELL_SIZE = 6

/** 放大倍数，1 = 适应窗口；再往外缩只会让画面更小，没有意义 */
export const MIN_ZOOM = 1
export const MAX_ZOOM = 8

export type Viewport = {
  cols: number
  rows: number
  /** 画布容器尺寸，CSS px */
  width: number
  height: number
  zoom: number
  /** 相对「居中摆放」的偏移，CSS px */
  panX: number
  panY: number
}

export type Placement = {
  /** 单格边长，CSS px；缩放后是小数 */
  cellSize: number
  /** 网格左上角在画布上的位置，CSS px */
  originX: number
  originY: number
}

/** 一格在画布上的方框 */
export type CellBox = { x: number; y: number; size: number }

function assertViewport(view: Viewport): void {
  if (!Number.isInteger(view.cols) || view.cols < 1) {
    throw new Error(`网格列数必须是正整数：${view.cols}`)
  }
  if (!Number.isInteger(view.rows) || view.rows < 1) {
    throw new Error(`网格行数必须是正整数：${view.rows}`)
  }
  if (!(view.width > 0) || !(view.height > 0)) {
    throw new Error(`画布尺寸必须为正数：${view.width} × ${view.height}`)
  }
  if (!(view.zoom > 0)) {
    throw new Error(`缩放倍数必须为正数：${view.zoom}`)
  }
}

/** 适应窗口时的一格边长：取两个方向里能放下的那个 */
export function fitCellSize(cols: number, rows: number, width: number, height: number): number {
  assertViewport({ cols, rows, width, height, zoom: 1, panX: 0, panY: 0 })
  return Math.min(width / cols, height / rows)
}

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) {
    return MIN_ZOOM
  }
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

/**
 * 网格在画布上的落位。
 * 内容比视口小的那个方向始终居中；比视口大时不留空白，最多把网格边缘贴到画布边上。
 */
export function placement(view: Viewport): Placement {
  assertViewport(view)
  const cellSize = fitCellSize(view.cols, view.rows, view.width, view.height) * view.zoom
  const contentWidth = view.cols * cellSize
  const contentHeight = view.rows * cellSize

  const axis = (content: number, viewport: number, pan: number): number => {
    const centred = (viewport - content) / 2
    if (content <= viewport) {
      return centred
    }
    // 内容比视口大：可动范围是 [viewport - content, 0]，再多就会出现空白
    return Math.min(0, Math.max(viewport - content, centred + pan))
  }

  return {
    cellSize,
    originX: axis(contentWidth, view.width, view.panX),
    originY: axis(contentHeight, view.height, view.panY),
  }
}

/** 第几格第几行的那一格在画布上的位置 */
export function cellRect(placed: Placement, col: number, row: number): CellBox {
  return {
    x: placed.originX + col * placed.cellSize,
    y: placed.originY + row * placed.cellSize,
    size: placed.cellSize,
  }
}

/** 画布上的点落在哪一格；落在网格外给 null */
export function cellAtPoint(
  placed: Placement,
  x: number,
  y: number,
  cols: number,
  rows: number,
): { col: number; row: number } | null {
  const col = Math.floor((x - placed.originX) / placed.cellSize)
  const row = Math.floor((y - placed.originY) / placed.cellSize)
  if (col < 0 || col >= cols || row < 0 || row >= rows) {
    return null
  }
  return { col, row }
}

/** 缩放时盯住指针底下那一格：缩放前后指针指的还是同一格 */
export function zoomAt(view: Viewport, point: { x: number; y: number }, factor: number): Viewport {
  const before = placement(view)
  const zoom = clampZoom(view.zoom * factor)
  if (zoom === view.zoom) {
    return view
  }

  const gridX = (point.x - before.originX) / before.cellSize
  const gridY = (point.y - before.originY) / before.cellSize
  const next: Viewport = { ...view, zoom }
  const centred = placement({ ...next, panX: 0, panY: 0 })

  return {
    ...next,
    panX: point.x - gridX * centred.cellSize - centred.originX,
    panY: point.y - gridY * centred.cellSize - centred.originY,
  }
}

export function panBy(view: Viewport, deltaX: number, deltaY: number): Viewport {
  return { ...view, panX: view.panX + deltaX, panY: view.panY + deltaY }
}

/** 屏幕上的两指：中点与间距。双指手势只看这两个量 */
export type Pinch = {
  centre: { x: number; y: number }
  distance: number
}

/**
 * 双指手势：间距比决定缩放、中点位移决定平移。
 * 缩放锚在中点上，两指之间的那一点在手势前后指着同一格。
 */
export function pinchView(view: Viewport, from: Pinch, to: Pinch): Viewport {
  const factor = from.distance > 0 ? to.distance / from.distance : 1
  const zoomed = zoomAt(view, from.centre, factor)
  return panBy(zoomed, to.centre.x - from.centre.x, to.centre.y - from.centre.y)
}

/** 回到适应窗口：缩放归位、平移清零 */
export function fitView(view: Viewport): Viewport {
  return { ...view, zoom: MIN_ZOOM, panX: 0, panY: 0 }
}

/**
 * 这一帧该用哪套画法。
 * 格宽低于阈值时豆形没有意义，用户的扁平选择任何尺寸下都算数（ADR-0003）。
 */
export function usesBeads(style: PreviewStyle, cellSize: number): boolean {
  return style === 'bead' && cellSize >= BEAD_MIN_CELL_SIZE
}
