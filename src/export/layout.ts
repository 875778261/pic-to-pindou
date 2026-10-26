/**
 * 导出图纸的排版。
 *
 * 只算位置与尺寸，不碰画布：一块画布该多大、网格从哪儿起、坐标数字隔几格标一次、
 * 图例排在哪儿。画的部分见 drawPattern.ts，这样排版规则能被单独测到（spec「不测 Canvas 像素」）。
 */

import { LABELLED_CELL_LIMIT, labelsCellCodes } from '../domain/pattern'

export const EXPORT_LIMITS = {
  /** 一格画多大。格子够大，色号才塞得进格内 */
  preferredCellSize: 24,
  /** 缩到再小就认不出格了，宁可到此为止 */
  minCellSize: 4,
  /** 画布单边上限：超过这个尺寸的图在手机上打不开 */
  maxCanvasSide: 8192,
  /** 画布总面积上限。iOS Safari 的画布上限约 1670 万像素，超过就编码不出图 */
  maxCanvasArea: 16_777_216,
} as const

const MARGIN = 32
/** 网格左侧留给行号 */
const ROW_GUTTER = 48
/** 网格上方留给列号 */
const COL_GUTTER = 32
/** 网格上方留给「多大、多少颗、色差声明」这几行字 */
const HEADER_HEIGHT = 88
const LEGEND_GAP = 24
const LEGEND_ROW_HEIGHT = 26
/** 图例一列最多排多少行，再多就并排下一列 */
const LEGEND_MAX_ROWS = 20

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

/** 图例的横向排布：色块边长、色号起点、颗数起点，都相对条目左边缘 */
export const LEGEND_METRICS = { swatch: 14, codeOffset: 22, countOffset: 76 } as const

export type Rect = { x: number; y: number; width: number; height: number }

export type ExportLayout = {
  cellSize: number
  /** 格内标不标色号 */
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
  /** 图例一条的宽度，同上。比网格一列还宽时画布要跟着长 */
  legendItemWidth?: number
}

/** 坐标数字的密度：格数一多，每格都标就是一堵灰墙 */
function coordinateStepFor(length: number): number {
  if (length <= LABELLED_CELL_LIMIT) {
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

function legendShape(legendEntryCount: number): { columns: number; rows: number } {
  if (legendEntryCount <= 0) {
    return { columns: 1, rows: 0 }
  }
  const columns = Math.ceil(legendEntryCount / LEGEND_MAX_ROWS)
  return { columns, rows: Math.ceil(legendEntryCount / columns) }
}

function clampCellSize(value: number): number {
  const { preferredCellSize, minCellSize } = EXPORT_LIMITS
  return Math.max(minCellSize, Math.min(preferredCellSize, value))
}

export function planExportLayout(input: ExportLayoutInput): ExportLayout {
  const { cols, rows, legendEntryCount, titleWidth = 0, legendItemWidth = 0 } = input
  if (cols <= 0 || rows <= 0) {
    throw new Error(`网格尺寸必须是正整数：${cols} × ${rows}`)
  }

  const legend = legendShape(legendEntryCount)
  const { maxCanvasSide, maxCanvasArea } = EXPORT_LIMITS

  const canvasSizeFor = (cellSize: number) => {
    const gridWidth = cols * cellSize
    const columnWidth = Math.max(Math.floor(gridWidth / legend.columns), legendItemWidth)
    // 纸面右侧要同时容得下网格、抬头文字与图例，三者取宽者
    const contentWidth = Math.max(gridWidth, titleWidth, legend.columns * columnWidth)
    return {
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

  // 首选格宽放不下就一路往下缩：单边与面积两条上限，任一顶到都要让路
  const fitsCaps = (cellSize: number) => {
    const size = canvasSizeFor(cellSize)
    return (
      size.width <= maxCanvasSide &&
      size.height <= maxCanvasSide &&
      size.width * size.height <= maxCanvasArea
    )
  }

  let cellSize: number = EXPORT_LIMITS.preferredCellSize
  while (cellSize > EXPORT_LIMITS.minCellSize && !fitsCaps(cellSize)) {
    cellSize -= 1
  }
  cellSize = clampCellSize(cellSize)

  const grid: Rect = {
    x: MARGIN + ROW_GUTTER,
    y: MARGIN + HEADER_HEIGHT + COL_GUTTER,
    width: cols * cellSize,
    height: rows * cellSize,
  }

  const legendY = grid.y + grid.height + LEGEND_GAP
  const columns = legend.columns
  const columnWidth = Math.max(Math.floor(grid.width / columns), legendItemWidth)
  const canvas = canvasSizeFor(cellSize)

  return {
    cellSize,
    labelled: labelsCellCodes(cols, rows),
    coordinateStep: { cols: coordinateStepFor(cols), rows: coordinateStepFor(rows) },
    grid,
    legend: {
      x: grid.x,
      y: legendY,
      width: columns * columnWidth,
      height: legend.rows * LEGEND_ROW_HEIGHT,
      columns,
      rows: legend.rows,
      rowHeight: LEGEND_ROW_HEIGHT,
      columnWidth,
    },
    header: { x: grid.x, y: MARGIN, lineHeight: 28 },
    canvas: {
      width: canvas.width,
      height:
        legend.rows > 0
          ? legendY + legend.rows * LEGEND_ROW_HEIGHT + MARGIN
          : grid.y + grid.height + MARGIN,
    },
  }
}
