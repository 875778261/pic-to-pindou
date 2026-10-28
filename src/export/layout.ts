/**
 * 导出图纸的排版。
 *
 * 只算位置与尺寸，不碰画布：一块画布该多大、网格从哪儿起、坐标数字隔几格标一次、
 * 图例排在哪儿。画的部分见 drawPattern.ts，这样排版规则能被单独测到（spec「不测 Canvas 像素」）。
 */

import { cellFitsCode } from '../domain/pattern'

export type ExportLimits = {
  /** 一颗豆占的像素。恒定值，不是搜索起点：图纸随格数变长，不为装进上限而缩小（ADR-0017） */
  cellSize: number
  /** 缩到再小就认不出格了，宁可到此为止 */
  minCellSize: number
  /** 画布单边上限：超过这个尺寸的图在手机上打不开 */
  maxCanvasSide: number
  /** 画布总面积上限。超了 toBlob 编码不出图 */
  maxCanvasArea: number
}

/** 面积上限。取「支持范围内最大的图纸仍能用满固定格宽」的那个值 */
export const EXPORT_LIMITS: ExportLimits = {
  cellSize: 24,
  minCellSize: 4,
  maxCanvasSide: 8192,
  maxCanvasArea: 25_000_000,
}

/**
 * 编码失败后重排用的预算：iOS Safari 的画布面积上限（ADR-0017）。
 */
export const SAFE_LIMITS: ExportLimits = { ...EXPORT_LIMITS, maxCanvasArea: 16_777_216 }

/**
 * 坐标「每格都标」的格数上限。
 * 与「标不标色号」无关：格内有色号时坐标仍然要变稀，两条判定各管各的。
 */
export const COORDINATE_DENSE_LIMIT = 40

const MARGIN = 32
/** 网格左侧留给行号 */
const ROW_GUTTER = 48
/** 网格上方留给列号 */
const COL_GUTTER = 32
/** 网格上方留给「多大、多少颗、色差声明」这几行字 */
const HEADER_HEIGHT = 88
const LEGEND_GAP = 24
const LEGEND_ROW_HEIGHT = 26

/**
 * 图纸上的字体。测量宽度与真正落笔必须用同一串，字体在这里定死，两边不再各写一份。
 */
export const SHEET_FONT_FAMILY = '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif'
export const SHEET_TYPE = {
  title: `600 20px ${SHEET_FONT_FAMILY}`,
  subtitle: `400 14px ${SHEET_FONT_FAMILY}`,
  legendCode: `500 14px ${SHEET_FONT_FAMILY}`,
  legendCount: `400 13px ${SHEET_FONT_FAMILY}`,
} as const

/**
 * 图例的横向排布。色块边长、色号起点、颗数起点都相对条目左边缘；
 * 条目间距是相邻两条之间的距离。颗数前不留名称列（ADR-0009）
 */
export const LEGEND_METRICS = { swatch: 14, codeOffset: 22, countOffset: 66, itemGap: 16 } as const

export type Rect = { x: number; y: number; width: number; height: number }

export type ExportLayout = {
  cellSize: number
  /** 格内标不标色号。按最终格宽判，格宽不为它让步（ADR-0015、ADR-0017） */
  labelled: boolean
  /** 行列号每隔几格标一次 */
  coordinateStep: { cols: number; rows: number }
  grid: Rect
  /** 图例区；没有用色时 rows 为 0 */
  legend: Rect & { columns: number; rows: number; rowHeight: number; columnWidth: number }
  /** 网格上方文字块的起点与行高 */
  header: { x: number; y: number; lineHeight: number }
  canvas: { width: number; height: number }
}

export type ExportLayoutInput = {
  cols: number
  rows: number
  /** 图例条目数，决定图例区高度 */
  legendEntryCount: number
  /** 抬头那行字的宽度，由合成层量好传进来 */
  titleWidth?: number
  /** 图例一条量出来的宽度（不含条目间距），同上。比网格一列还宽时画布要跟着长 */
  legendItemWidth?: number
}

/** 坐标数字的密度：格数一多，每格都标就是一堵灰墙 */
function coordinateStepFor(length: number): number {
  if (length <= COORDINATE_DENSE_LIMIT) {
    return 1
  }
  return length <= 100 ? 5 : 10
}

/** 要画坐标的格位（从 0 起）。末格一定在内，否则最右一列、最下一行没有号可认 */
export function coordinateIndexes(length: number, step: number): number[] {
  const indexes: number[] = []
  for (let index = 0; index < length; index += step) {
    indexes.push(index)
  }
  const last = length - 1
  if (last >= 0 && indexes.at(-1) !== last) {
    indexes.push(last)
  }
  return indexes
}

/** 单条图例占的横向宽度：量出来的条目宽加上条目间距 */
function slotWidthOf(legendItemWidth: number): number {
  return legendItemWidth > 0 ? legendItemWidth + LEGEND_METRICS.itemGap : 0
}

/** 图例的换行：每行放几条由纸面可用宽度与单条槽宽决定，再按条目数推行数（ADR-0008） */
function legendShape(
  legendEntryCount: number,
  availableWidth: number,
  legendItemWidth: number,
): { columns: number; rows: number } {
  if (legendEntryCount <= 0) {
    return { columns: 1, rows: 0 }
  }
  const slotWidth = slotWidthOf(legendItemWidth)
  // 单条宽度还没量出来就不猜能并排几条，按一列排
  const perRow = slotWidth > 0 ? Math.max(1, Math.floor(availableWidth / slotWidth)) : 1
  return { columns: perRow, rows: Math.ceil(legendEntryCount / perRow) }
}

/** 第几条图例落在第几列第几行。行优先填，与图例的换行方向一致 */
export function legendSlot(index: number, columns: number): { column: number; row: number } {
  return { column: index % columns, row: Math.floor(index / columns) }
}

export function planExportLayout(
  input: ExportLayoutInput,
  limits: ExportLimits = EXPORT_LIMITS,
): ExportLayout {
  const { cols, rows, legendEntryCount, titleWidth = 0, legendItemWidth = 0 } = input
  if (cols <= 0 || rows <= 0) {
    throw new Error(`网格尺寸必须是正整数：${cols} × ${rows}`)
  }

  /** 某个格宽下的纸面尺寸。格宽与图例尺寸互相依赖，一次算全 */
  const paperAt = (cellSize: number) => {
    const gridWidth = cols * cellSize
    // 抬头可能比网格还宽，图例跟着纸面摊开，不跟着网格摊
    const availableWidth = Math.max(gridWidth, titleWidth)
    const legend = legendShape(legendEntryCount, availableWidth, legendItemWidth)
    const columnWidth = Math.max(
      Math.floor(availableWidth / legend.columns),
      slotWidthOf(legendItemWidth),
    )
    const legendWidth = legend.columns * columnWidth
    // 纸面右侧要同时容得下网格、抬头文字与图例，三者取宽者
    const contentWidth = Math.max(gridWidth, titleWidth, legendWidth)
    return {
      legend,
      columnWidth,
      legendWidth,
      width: MARGIN + ROW_GUTTER + contentWidth + MARGIN,
      height:
        MARGIN +
        HEADER_HEIGHT +
        COL_GUTTER +
        rows * cellSize +
        (legend.rows > 0 ? LEGEND_GAP + legend.rows * LEGEND_ROW_HEIGHT : 0) +
        MARGIN,
    }
  }

  // 单边与面积两条上限，任一顶到都要让路
  const fitsCaps = (cellSize: number): boolean => {
    const { width, height } = paperAt(cellSize)
    return (
      width <= limits.maxCanvasSide &&
      height <= limits.maxCanvasSide &&
      width * height <= limits.maxCanvasArea
    )
  }

  /**
   * 格宽从固定值往下让，取第一个装得进上限的。让到最小格宽仍装不进就按最小格宽出图：
   * 宁可交出一张超上限的排版，也不在这里拒绝导出。
   */
  const fitCellSize = (): number => {
    for (let cellSize = limits.cellSize; cellSize >= limits.minCellSize; cellSize -= 1) {
      if (fitsCaps(cellSize)) {
        return cellSize
      }
    }
    return limits.minCellSize
  }

  const cellSize = fitCellSize()

  const paper = paperAt(cellSize)
  const grid: Rect = {
    x: MARGIN + ROW_GUTTER,
    y: MARGIN + HEADER_HEIGHT + COL_GUTTER,
    width: cols * cellSize,
    height: rows * cellSize,
  }

  return {
    cellSize,
    labelled: cellFitsCode(cellSize),
    coordinateStep: { cols: coordinateStepFor(cols), rows: coordinateStepFor(rows) },
    grid,
    legend: {
      x: grid.x,
      y: grid.y + grid.height + LEGEND_GAP,
      width: paper.legendWidth,
      height: paper.legend.rows * LEGEND_ROW_HEIGHT,
      columns: paper.legend.columns,
      rows: paper.legend.rows,
      rowHeight: LEGEND_ROW_HEIGHT,
      columnWidth: paper.columnWidth,
    },
    header: { x: grid.x, y: MARGIN, lineHeight: 28 },
    canvas: { width: paper.width, height: paper.height },
  }
}

/** 这张排版超出安全预算：手机上可能画不出来，得退到 `SAFE_LIMITS` 重排 */
export function exceedsSafeBudget(layout: ExportLayout): boolean {
  return layout.canvas.width * layout.canvas.height > SAFE_LIMITS.maxCanvasArea
}
