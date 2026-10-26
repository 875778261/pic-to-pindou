import { describe, expect, it } from 'vitest'
import {
  BEAD_MIN_CELL_SIZE,
  cellAtPoint,
  cellRect,
  fitCellSize,
  MAX_ZOOM,
  panBy,
  pinchView,
  placement,
  usesBeads,
  type Viewport,
  zoomAt,
} from './viewport'

function viewOf(overrides: Partial<Viewport> = {}): Viewport {
  return { cols: 29, rows: 29, width: 580, height: 580, zoom: 1, panX: 0, panY: 0, ...overrides }
}

describe('预览视口', () => {
  it('适应窗口时单格边长取两个方向里小的那个，整张网格放得下', () => {
    // 29 列 580px 宽 → 20px/格；高只给 290px → 10px/格，取小的
    const cellSize = fitCellSize(29, 29, 580, 290)
    expect(cellSize).toBeCloseTo(10)
    expect(29 * cellSize).toBeLessThanOrEqual(580)
    expect(29 * cellSize).toBeLessThanOrEqual(290)
  })

  it('网格比视口小时居中，比视口大时贴住左上不留空', () => {
    const small = placement(viewOf())
    expect(small.originX).toBeCloseTo(0)
    expect(small.originY).toBeCloseTo(0)

    const wide = placement(viewOf({ width: 900, height: 700 }))
    expect(wide.cellSize).toBeCloseTo(700 / 29)
    expect(wide.originX).toBeCloseTo((900 - 29 * wide.cellSize) / 2)
    expect(wide.originY).toBeCloseTo(0)
  })

  it('放大后可以把网格拖出视口一部分，但拖不出空白', () => {
    const zoomed = viewOf({ zoom: 2, panX: 5000, panY: 5000 })
    const topLeft = placement(zoomed)
    expect(topLeft.originX).toBeCloseTo(0)
    expect(topLeft.originY).toBeCloseTo(0)

    const bottomRight = placement(viewOf({ zoom: 2, panX: -5000, panY: -5000 }))
    expect(bottomRight.originX).toBeCloseTo(580 - 29 * bottomRight.cellSize)
    expect(bottomRight.originY).toBeCloseTo(580 - 29 * bottomRight.cellSize)
  })

  it('同一份摆放在两种画法下逐格对齐，相邻格原点差恒为一格边长', () => {
    const view = viewOf({ zoom: 1.7, panX: -40, panY: -12 })
    const { cellSize } = placement(view)
    const first = cellRect(placement(view), 0, 0)
    const second = cellRect(placement(view), 1, 0)
    const below = cellRect(placement(view), 0, 1)

    expect(first.size).toBeCloseTo(cellSize)
    expect(second.x - first.x).toBeCloseTo(cellSize)
    expect(below.y - first.y).toBeCloseTo(cellSize)
    expect(second.y).toBeCloseTo(first.y)
  })

  it('放大时指针底下那一格不动', () => {
    const view = viewOf({ width: 800, height: 600 })
    const point = { x: 500, y: 300 }
    const before = cellAtPoint(placement(view), point.x, point.y, view.cols, view.rows)
    if (!before) {
      throw new Error('测试点落在网格外，前提不成立')
    }

    const zoomed = zoomAt(view, point, 2)
    const after = cellAtPoint(placement(zoomed), point.x, point.y, view.cols, view.rows)
    expect(after).toEqual(before)
    expect(zoomed.zoom).toBeCloseTo(2)
  })

  it('缩放有上下限，缩到最小时退不回适应窗口以下', () => {
    const view = viewOf()
    expect(zoomAt(view, { x: 100, y: 100 }, 0.1).zoom).toBeCloseTo(1)
    expect(zoomAt(view, { x: 100, y: 100 }, 100).zoom).toBeCloseTo(MAX_ZOOM)
  })

  it('平移只移动画面，不改变单格边长', () => {
    const view = viewOf({ zoom: 3 })
    const moved = panBy(view, -120, -80)
    expect(placement(moved).cellSize).toBeCloseTo(placement(view).cellSize)
    expect(placement(moved).originX).toBeLessThan(placement(view).originX)
  })

  it('格宽低于阈值自动改用扁平画法，等于阈值起用豆形', () => {
    expect(usesBeads('bead', BEAD_MIN_CELL_SIZE)).toBe(true)
    expect(usesBeads('bead', BEAD_MIN_CELL_SIZE - 0.01)).toBe(false)
    expect(usesBeads('flat', 40)).toBe(false)
  })

  it('网格外的点不落在任何一格上', () => {
    const view = viewOf({ width: 900 })
    const { originX, cellSize } = placement(view)
    expect(cellAtPoint(placement(view), originX - 1, 0, view.cols, view.rows)).toBeNull()
    expect(
      cellAtPoint(placement(view), originX + 29 * cellSize, 0, view.cols, view.rows),
    ).toBeNull()
  })

  it('参数非法时直接抛，不静默算出一个能画的视口', () => {
    expect(() => fitCellSize(0, 29, 580, 580)).toThrow()
    expect(() => fitCellSize(29, 29, 0, 580)).toThrow()
    expect(() => placement(viewOf({ zoom: 0 }))).toThrow()
  })
})

describe('双指手势', () => {
  it('两指拉开一倍，缩放也翻一倍', () => {
    const view = viewOf({ zoom: 2 })
    const next = pinchView(
      view,
      { centre: { x: 290, y: 290 }, distance: 100 },
      { centre: { x: 290, y: 290 }, distance: 200 },
    )
    expect(next.zoom).toBeCloseTo(4)
  })

  it('两指捏拢就缩小', () => {
    const view = viewOf({ zoom: 4 })
    const next = pinchView(
      view,
      { centre: { x: 290, y: 290 }, distance: 200 },
      { centre: { x: 290, y: 290 }, distance: 100 },
    )
    expect(next.zoom).toBeCloseTo(2)
  })

  it('中点不动时，中点底下还是同一格', () => {
    const view = viewOf({ zoom: 2 })
    const centre = { x: 290, y: 290 }
    const before = placement(view)
    const next = pinchView(view, { centre, distance: 100 }, { centre, distance: 240 })
    const after = placement(next)

    const gridX = (centre.x - before.originX) / before.cellSize
    const gridY = (centre.y - before.originY) / before.cellSize
    expect((centre.x - after.originX) / after.cellSize).toBeCloseTo(gridX)
    expect((centre.y - after.originY) / after.cellSize).toBeCloseTo(gridY)
  })

  it('两指一起往右挪，画面跟着往右挪', () => {
    const view = viewOf({ zoom: 3 })
    const next = pinchView(
      view,
      { centre: { x: 200, y: 280 }, distance: 150 },
      { centre: { x: 320, y: 280 }, distance: 150 },
    )
    expect(next.zoom).toBeCloseTo(3)
    expect(placement(next).originX).toBeGreaterThan(placement(view).originX)
  })

  it('放大到上限就停住，不会越界', () => {
    const view = viewOf({ zoom: MAX_ZOOM - 1 })
    const next = pinchView(
      view,
      { centre: { x: 290, y: 290 }, distance: 100 },
      { centre: { x: 290, y: 290 }, distance: 900 },
    )
    expect(next.zoom).toBeCloseTo(MAX_ZOOM)
  })

  it('两指重合时不报错，缩放原样不动', () => {
    const view = viewOf({ zoom: 2 })
    const next = pinchView(
      view,
      { centre: { x: 100, y: 100 }, distance: 0 },
      { centre: { x: 100, y: 100 }, distance: 50 },
    )
    expect(next.zoom).toBeCloseTo(2)
  })
})
