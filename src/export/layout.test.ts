import { describe, expect, it } from 'vitest'
import { MIN_CODE_CELL_SIZE } from '../domain/pattern'
import {
  coordinateIndexes,
  EXPORT_LIMITS,
  legendSlot,
  planExportLayout,
  SAFE_LIMITS,
} from './layout'

describe('导出排版', () => {
  it('一颗豆恒占 24 像素，网格区域正好是格数乘格宽', () => {
    const layout = planExportLayout({ cols: 29, rows: 29, legendEntryCount: 3 })

    expect(layout.cellSize).toBe(EXPORT_LIMITS.cellSize)
    expect(layout.grid.width).toBe(29 * layout.cellSize)
    expect(layout.grid.height).toBe(29 * layout.cellSize)
  })

  it('行列号与顶部说明各占一块地方，不压在网格上', () => {
    const layout = planExportLayout({ cols: 29, rows: 29, legendEntryCount: 0 })

    expect(layout.grid.x).toBeGreaterThan(0)
    expect(layout.grid.y).toBeGreaterThan(0)
    expect(layout.canvas.width - (layout.grid.x + layout.grid.width)).toBeGreaterThan(0)
  })

  it('网格再大也照标色号：格宽恒定，不再拿它换标注', () => {
    for (const side of [40, 41, 87, 200]) {
      expect(planExportLayout({ cols: side, rows: side, legendEntryCount: 0 }).labelled).toBe(true)
    }
  })

  it('最常用的 2 块板 29 × 58 必须标色号', () => {
    expect(planExportLayout({ cols: 29, rows: 58, legendEntryCount: 12 }).labelled).toBe(true)
  })

  it('声明上限内最大的方形网格仍是 24 像素', () => {
    const layout = planExportLayout({ cols: 200, rows: 200, legendEntryCount: 0 })

    expect(layout.cellSize).toBe(EXPORT_LIMITS.cellSize)
    expect(layout.canvas.width * layout.canvas.height).toBeLessThanOrEqual(
      EXPORT_LIMITS.maxCanvasArea,
    )
  })

  it('安全预算装不下才降格宽，降了仍标色号', () => {
    const layout = planExportLayout({ cols: 200, rows: 200, legendEntryCount: 0 }, SAFE_LIMITS)

    expect(layout.cellSize).toBeLessThan(EXPORT_LIMITS.cellSize)
    expect(layout.canvas.width * layout.canvas.height).toBeLessThanOrEqual(
      SAFE_LIMITS.maxCanvasArea,
    )
    expect(layout.labelled).toBe(true)
  })

  it('连可读下限都破上限时才不标，格宽继续缩到装得下', () => {
    // 上限压到 800 万：11px 格宽才过，低于标色号的下限
    const tight = { ...EXPORT_LIMITS, maxCanvasArea: 8_000_000 }
    const layout = planExportLayout({ cols: 200, rows: 200, legendEntryCount: 40 }, tight)

    expect(layout.labelled).toBe(false)
    expect(layout.cellSize).toBeGreaterThanOrEqual(EXPORT_LIMITS.minCellSize)
    expect(layout.cellSize).toBeLessThan(MIN_CODE_CELL_SIZE)
    expect(layout.canvas.width * layout.canvas.height).toBeLessThanOrEqual(tight.maxCanvasArea)
  })

  it('坐标密度不跟着色号判定走：41 格标色号，坐标照样变稀', () => {
    const dense = planExportLayout({ cols: 40, rows: 40, legendEntryCount: 0 })
    const sparse = planExportLayout({ cols: 41, rows: 41, legendEntryCount: 0 })
    const sparser = planExportLayout({ cols: 200, rows: 200, legendEntryCount: 0 })

    expect(sparse.labelled).toBe(true)
    expect(dense.coordinateStep).toEqual({ cols: 1, rows: 1 })
    expect(sparse.coordinateStep).toEqual({ cols: 5, rows: 5 })
    expect(sparser.coordinateStep).toEqual({ cols: 10, rows: 10 })
  })

  it('格数多时坐标隔几格标一次，免得糊成一团', () => {
    const dense = planExportLayout({ cols: 29, rows: 29, legendEntryCount: 0 })
    const sparse = planExportLayout({ cols: 200, rows: 200, legendEntryCount: 0 })

    expect(dense.coordinateStep).toEqual({ cols: 1, rows: 1 })
    expect(sparse.coordinateStep.cols).toBeGreaterThan(1)
    expect(sparse.coordinateStep.rows).toBeGreaterThan(1)
    expect(sparse.coordinateStep.cols).toBe(sparse.coordinateStep.rows)
  })

  it('200 × 200 在声明上限内用满 24 像素', () => {
    // 16 个色号、单条约 110px：图例一行摊开，不额外吃掉高度
    const layout = planExportLayout({
      cols: 200,
      rows: 200,
      legendEntryCount: 16,
      legendItemWidth: 110,
    })

    expect(layout.cellSize).toBe(EXPORT_LIMITS.cellSize)
    expect(layout.canvas.width).toBeLessThanOrEqual(EXPORT_LIMITS.maxCanvasSide)
    expect(layout.canvas.height).toBeLessThanOrEqual(EXPORT_LIMITS.maxCanvasSide)
    expect(layout.canvas.width * layout.canvas.height).toBeLessThanOrEqual(
      EXPORT_LIMITS.maxCanvasArea,
    )
  })

  it('装得下的网格不会白缩', () => {
    const layout = planExportLayout({ cols: 58, rows: 58, legendEntryCount: 12 })

    expect(layout.cellSize).toBe(EXPORT_LIMITS.cellSize)
  })

  it('图例排在网格下方，装得下所有条目', () => {
    const layout = planExportLayout({ cols: 29, rows: 29, legendEntryCount: 40 })

    expect(layout.legend.y).toBeGreaterThanOrEqual(layout.grid.y + layout.grid.height)
    expect(layout.legend.rows * layout.legend.columns).toBeGreaterThanOrEqual(40)
    expect(layout.canvas.height).toBeGreaterThanOrEqual(
      layout.legend.y + layout.legend.rows * layout.legend.rowHeight,
    )
  })

  it('图例每行条数由纸面宽度与单条宽度决定，容量装得下所有条目', () => {
    // 29 格 × 24 像素 = 696 宽；单条 100 加间距 16 共 116 → 每行 6 条，40 条排 7 行
    const layout = planExportLayout({
      cols: 29,
      rows: 29,
      legendEntryCount: 40,
      legendItemWidth: 100,
    })

    expect(layout.legend.columns).toBe(6)
    expect(layout.legend.rows).toBe(7)
    expect(layout.legend.rows * layout.legend.columns).toBeGreaterThanOrEqual(40)
  })

  it('宽纸上图例摊成少数几行，不按条目数把列算死', () => {
    const layout = planExportLayout({
      cols: 200,
      rows: 200,
      legendEntryCount: 40,
      legendItemWidth: 150,
    })

    expect(layout.legend.rows * layout.legend.columns).toBeGreaterThanOrEqual(40)
    expect(layout.legend.rows).toBeLessThan(5)
  })

  it('不传单条宽度时按一列排，条目少也排成一列', () => {
    const layout = planExportLayout({ cols: 29, rows: 29, legendEntryCount: 5 })

    expect(layout.legend.columns).toBe(1)
    expect(layout.legend.rows).toBe(5)
  })

  it('单条比纸面还宽时仍至少占一条，不会排成零列', () => {
    const layout = planExportLayout({
      cols: 8,
      rows: 5,
      legendEntryCount: 3,
      legendItemWidth: 400,
    })

    expect(layout.legend.columns).toBe(1)
    expect(layout.legend.rows).toBe(3)
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

describe('图例条目落格', () => {
  it('行优先填：排满一行才换下一行', () => {
    // 每行 6 条：第 0 条落在左上，第 5 条是首行末位，第 6 条换到第二行首位
    expect(legendSlot(0, 6)).toEqual({ column: 0, row: 0 })
    expect(legendSlot(5, 6)).toEqual({ column: 5, row: 0 })
    expect(legendSlot(6, 6)).toEqual({ column: 0, row: 1 })
    expect(legendSlot(39, 6)).toEqual({ column: 3, row: 6 })
  })

  it('一列时逐行往下排', () => {
    expect(legendSlot(0, 1)).toEqual({ column: 0, row: 0 })
    expect(legendSlot(4, 1)).toEqual({ column: 0, row: 4 })
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
