import { describe, expect, it } from 'vitest'
import { labelsCellCodes } from '../domain/pattern'
import { coordinateIndexes, EXPORT_LIMITS, planExportLayout } from './layout'

describe('导出排版', () => {
  it('一格 24 像素，网格区域正好是格数乘格宽', () => {
    const layout = planExportLayout({ cols: 29, rows: 29, legendEntryCount: 3 })

    expect(layout.cellSize).toBe(EXPORT_LIMITS.preferredCellSize)
    expect(layout.grid.width).toBe(29 * layout.cellSize)
    expect(layout.grid.height).toBe(29 * layout.cellSize)
  })

  it('行列号与顶部说明各占一块地方，不压在网格上', () => {
    const layout = planExportLayout({ cols: 29, rows: 29, legendEntryCount: 0 })

    expect(layout.grid.x).toBeGreaterThan(0)
    expect(layout.grid.y).toBeGreaterThan(0)
    expect(layout.canvas.width - (layout.grid.x + layout.grid.width)).toBeGreaterThan(0)
  })

  it('是否标注格内色号与 domain 的判定一致，40 前后翻转', () => {
    expect(planExportLayout({ cols: 40, rows: 40, legendEntryCount: 0 }).labelled).toBe(
      labelsCellCodes(40, 40),
    )
    expect(planExportLayout({ cols: 41, rows: 41, legendEntryCount: 0 }).labelled).toBe(
      labelsCellCodes(41, 41),
    )
    expect(planExportLayout({ cols: 40, rows: 40, legendEntryCount: 0 }).labelled).toBe(true)
    expect(planExportLayout({ cols: 41, rows: 41, legendEntryCount: 0 }).labelled).toBe(false)
  })

  it('格数多时坐标隔几格标一次，免得糊成一团', () => {
    const dense = planExportLayout({ cols: 29, rows: 29, legendEntryCount: 0 })
    const sparse = planExportLayout({ cols: 200, rows: 200, legendEntryCount: 0 })

    expect(dense.coordinateStep).toEqual({ cols: 1, rows: 1 })
    expect(sparse.coordinateStep.cols).toBeGreaterThan(1)
    expect(sparse.coordinateStep.rows).toBeGreaterThan(1)
    expect(sparse.coordinateStep.cols).toBe(sparse.coordinateStep.rows)
  })

  it('200 × 200 会缩格宽，把画布压进单边与面积两条上限', () => {
    const layout = planExportLayout({ cols: 200, rows: 200, legendEntryCount: 40 })

    expect(layout.cellSize).toBeLessThanOrEqual(EXPORT_LIMITS.preferredCellSize)
    expect(layout.canvas.width).toBeLessThanOrEqual(EXPORT_LIMITS.maxCanvasSide)
    expect(layout.canvas.height).toBeLessThanOrEqual(EXPORT_LIMITS.maxCanvasSide)
    expect(layout.canvas.width * layout.canvas.height).toBeLessThanOrEqual(
      EXPORT_LIMITS.maxCanvasArea,
    )
  })

  it('尺寸不紧的网格仍按首选格宽画，不白缩', () => {
    const layout = planExportLayout({ cols: 58, rows: 58, legendEntryCount: 12 })

    expect(layout.cellSize).toBe(EXPORT_LIMITS.preferredCellSize)
  })

  it('更大的网格缩格宽，绝不超上限', () => {
    const layout = planExportLayout({ cols: 400, rows: 400, legendEntryCount: 40 })

    expect(layout.cellSize).toBeLessThan(EXPORT_LIMITS.preferredCellSize)
    expect(layout.cellSize).toBeGreaterThanOrEqual(EXPORT_LIMITS.minCellSize)
    expect(layout.canvas.width).toBeLessThanOrEqual(EXPORT_LIMITS.maxCanvasSide)
    expect(layout.canvas.height).toBeLessThanOrEqual(EXPORT_LIMITS.maxCanvasSide)
    expect(layout.canvas.width * layout.canvas.height).toBeLessThanOrEqual(
      EXPORT_LIMITS.maxCanvasArea,
    )
  })

  it('图例排在网格下方，装得下所有条目', () => {
    const layout = planExportLayout({ cols: 29, rows: 29, legendEntryCount: 40 })

    expect(layout.legend.y).toBeGreaterThanOrEqual(layout.grid.y + layout.grid.height)
    expect(layout.legend.rows * layout.legend.columns).toBeGreaterThanOrEqual(40)
    expect(layout.canvas.height).toBeGreaterThanOrEqual(
      layout.legend.y + layout.legend.rows * layout.legend.rowHeight,
    )
  })

  it('图例条目少时排成一列', () => {
    const layout = planExportLayout({ cols: 29, rows: 29, legendEntryCount: 5 })

    expect(layout.legend.columns).toBe(1)
    expect(layout.legend.rows).toBe(5)
  })

  it('没有用色时不排图例，也不留空高度', () => {
    const empty = planExportLayout({ cols: 29, rows: 29, legendEntryCount: 0 })
    const one = planExportLayout({ cols: 29, rows: 29, legendEntryCount: 1 })

    expect(empty.legend.rows).toBe(0)
    expect(empty.canvas.height).toBeLessThan(one.canvas.height)
  })

  it('同一份输入每次排版一致', () => {
    const input = { cols: 58, rows: 29, legendEntryCount: 17 }
    expect(planExportLayout(input)).toEqual(planExportLayout(input))
  })

  it('抬头或图例比网格宽时，纸跟着变宽', () => {
    const narrow = planExportLayout({ cols: 8, rows: 5, legendEntryCount: 3 })
    const wideTitle = planExportLayout({
      cols: 8,
      rows: 5,
      legendEntryCount: 3,
      titleWidth: 600,
    })
    const wideLegend = planExportLayout({
      cols: 8,
      rows: 5,
      legendEntryCount: 3,
      legendItemWidth: 400,
    })

    expect(wideTitle.canvas.width).toBeGreaterThan(narrow.canvas.width)
    expect(wideLegend.canvas.width).toBeGreaterThan(narrow.canvas.width)
    // 网格本身不动，只是右边留出写字的地方
    expect(wideTitle.grid).toEqual(narrow.grid)
  })

  it('图例一条比网格一列还宽时，列宽按条目宽度走', () => {
    const narrow = planExportLayout({ cols: 8, rows: 5, legendEntryCount: 3 })
    const wide = planExportLayout({
      cols: 8,
      rows: 5,
      legendEntryCount: 3,
      legendItemWidth: 300,
    })

    expect(narrow.legend.columnWidth).toBeLessThan(300)
    expect(wide.legend.columnWidth).toBeGreaterThanOrEqual(300)
  })
})

describe('坐标标号', () => {
  it('每格都标时从第一格到最后一格一个不漏', () => {
    expect(coordinateIndexes(5, 1)).toEqual([0, 1, 2, 3, 4])
    expect(coordinateIndexes(29, 1)).toHaveLength(29)
  })

  it('隔格标时最后一格一定在内，否则最右一列认不出', () => {
    const dense = coordinateIndexes(200, 10)
    expect(dense.at(-1)).toBe(199)
    expect(dense.slice(-3)).toEqual([180, 190, 199])
  })

  it('末格本来就落在标号上时不重复', () => {
    expect(coordinateIndexes(21, 10)).toEqual([0, 10, 20])
  })

  it('一格宽也有一格号', () => {
    expect(coordinateIndexes(1, 10)).toEqual([0])
  })
})
