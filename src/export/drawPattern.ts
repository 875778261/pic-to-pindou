/**
 * 图纸 PNG 的离屏合成。
 *
 * 导出的是施工图，不是成品效果图：格子用扁平色块，格内色号才看得清。
 * 豆形画法是屏幕预览的事（ADR-0003），两者共用同一份网格数据。
 */

import { type BeadSize, formatPatternSize, patternSizeMm } from '../domain/bead-size'
import { hexToRgb } from '../domain/colour'
import { BLANK_CELL, cellAt, totalBeads } from '../domain/grid'
import type { Palette } from '../domain/palette/types'
import {
  type LegendEntry,
  legendEntries,
  type Pattern,
  paletteEntryForCell,
} from '../domain/pattern'
import { BLANK_CELL_HEX, INK_HEX, MUTED_INK_HEX } from '../render/colours'
import {
  coordinateIndexes,
  type ExportLayout,
  LEGEND_METRICS,
  legendSlot,
  planExportLayout,
  SHEET_FONT_FAMILY,
  SHEET_TYPE,
} from './layout'

const PAPER_HEX = '#FFFFFF'
/** 空白格的圈色比格底深一档，纸上和白色豆分得开 */
const BLANK_RING_HEX = '#9CA3AF'
const GRID_LINE_HEX = '#D1D5DB'

/** 屏幕上仅供参考的那句话，图纸一离开网页就得自带这句 */
export const COLOUR_CAVEAT = '屏幕颜色仅供参考，实物存在色差'

export type PatternSheetInput = {
  pattern: Pattern
  palette: Palette
  beadSize: BeadSize
}

/** 浅色底上用深字，深色底上用白字 */
function textColourOn(hex: string): string {
  const { r, g, b } = hexToRgb(hex)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? INK_HEX : '#FFFFFF'
}

/** 图例一条的文字。量宽度与落笔共用这一句，改格式不会只改一半 */
function legendItemText(entry: LegendEntry): string {
  return `${entry.count} 颗`
}

/** 缩字号直到塞得进格子，色号不会被相邻格压掉 */
function fitFontSize(context: CanvasRenderingContext2D, text: string, maxWidth: number): number {
  let size = Math.max(6, Math.floor(maxWidth * 0.46))
  while (size > 6) {
    context.font = `500 ${size}px ${SHEET_FONT_FAMILY}`
    if (context.measureText(text).width <= maxWidth) {
      return size
    }
    size -= 1
  }
  return size
}

/**
 * 量抬头与图例各要多宽。
 * 量宽度离不开画布，所以在这一层量好再交给排版，纸多大多宽仍由排版定。
 */
function measureTextBlocks(
  summary: string,
  entries: readonly LegendEntry[],
): { titleWidth: number; legendItemWidth: number } {
  const scratch = document.createElement('canvas')
  const context = scratch.getContext('2d')
  if (!context) {
    return { titleWidth: 0, legendItemWidth: 0 }
  }

  context.font = SHEET_TYPE.title
  const titleWidth = Math.ceil(context.measureText(summary).width)

  context.font = SHEET_TYPE.legendCount
  let legendItemWidth = 0
  for (const entry of entries) {
    legendItemWidth = Math.max(
      legendItemWidth,
      LEGEND_METRICS.countOffset + Math.ceil(context.measureText(legendItemText(entry)).width),
    )
  }
  return { titleWidth, legendItemWidth }
}

function drawHeader(
  context: CanvasRenderingContext2D,
  layout: ExportLayout,
  summary: string,
): void {
  const { x, y, lineHeight } = layout.header
  context.textAlign = 'left'
  context.textBaseline = 'top'
  context.fillStyle = INK_HEX
  context.font = SHEET_TYPE.title
  context.fillText(summary, x, y)
  context.fillStyle = MUTED_INK_HEX
  context.font = SHEET_TYPE.subtitle
  context.fillText(COLOUR_CAVEAT, x, y + lineHeight)
}

function drawCoordinates(
  context: CanvasRenderingContext2D,
  layout: ExportLayout,
  cols: number,
  rows: number,
): void {
  const { cellSize, grid, coordinateStep } = layout
  context.fillStyle = MUTED_INK_HEX
  context.font = `400 ${Math.max(9, Math.min(13, Math.round(cellSize * 0.5)))}px ${SHEET_FONT_FAMILY}`

  context.textAlign = 'center'
  context.textBaseline = 'bottom'
  for (const col of coordinateIndexes(cols, coordinateStep.cols)) {
    context.fillText(String(col + 1), grid.x + col * cellSize + cellSize / 2, grid.y - 6)
  }

  context.textAlign = 'right'
  context.textBaseline = 'middle'
  for (const row of coordinateIndexes(rows, coordinateStep.rows)) {
    context.fillText(String(row + 1), grid.x - 8, grid.y + row * cellSize + cellSize / 2)
  }
}

function drawCells(
  context: CanvasRenderingContext2D,
  layout: ExportLayout,
  input: PatternSheetInput,
): void {
  const { cellSize, grid, labelled } = layout
  const { pattern, palette } = input
  const { cols, rows } = pattern.grid

  context.textAlign = 'center'
  context.textBaseline = 'middle'

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const cell = cellAt(pattern.grid, col, row)
      const x = grid.x + col * cellSize
      const y = grid.y + row * cellSize

      if (cell === BLANK_CELL) {
        // 空心圆代表板上露出的钉，和白色豆的实心格区分开
        context.beginPath()
        context.arc(x + cellSize / 2, y + cellSize / 2, cellSize * 0.34, 0, Math.PI * 2)
        context.fillStyle = BLANK_CELL_HEX
        context.fill()
        context.strokeStyle = BLANK_RING_HEX
        context.lineWidth = Math.max(1, cellSize * 0.08)
        context.stroke()
        continue
      }

      const entry = paletteEntryForCell(palette, cell)
      const hex = entry?.hex ?? BLANK_CELL_HEX
      context.fillStyle = hex
      context.fillRect(x, y, cellSize, cellSize)

      if (!labelled || !entry) {
        continue
      }
      const fontSize = fitFontSize(context, entry.code, cellSize - 3)
      context.fillStyle = textColourOn(hex)
      context.font = `500 ${fontSize}px ${SHEET_FONT_FAMILY}`
      context.fillText(entry.code, x + cellSize / 2, y + cellSize / 2 + 1)
    }
  }
}

function drawGridLines(
  context: CanvasRenderingContext2D,
  layout: ExportLayout,
  cols: number,
  rows: number,
): void {
  const { cellSize, grid } = layout
  context.strokeStyle = GRID_LINE_HEX
  context.lineWidth = 1
  context.beginPath()
  for (let col = 0; col <= cols; col += 1) {
    const x = grid.x + col * cellSize + 0.5
    context.moveTo(x, grid.y)
    context.lineTo(x, grid.y + rows * cellSize)
  }
  for (let row = 0; row <= rows; row += 1) {
    const y = grid.y + row * cellSize + 0.5
    context.moveTo(grid.x, y)
    context.lineTo(grid.x + cols * cellSize, y)
  }
  context.stroke()
}

function drawLegend(
  context: CanvasRenderingContext2D,
  layout: ExportLayout,
  entries: readonly LegendEntry[],
): void {
  if (layout.legend.rows === 0) {
    return
  }
  const { x, y, rowHeight, columnWidth, columns } = layout.legend
  const { swatch, codeOffset, countOffset } = LEGEND_METRICS

  context.textAlign = 'left'
  context.textBaseline = 'middle'

  entries.forEach((entry, index) => {
    const { column, row } = legendSlot(index, columns)
    const itemX = x + column * columnWidth
    const itemY = y + row * rowHeight

    context.fillStyle = entry.hex
    context.fillRect(itemX, itemY + 3, swatch, swatch)
    context.strokeStyle = GRID_LINE_HEX
    context.lineWidth = 1
    context.strokeRect(itemX + 0.5, itemY + 3.5, swatch, swatch)

    context.fillStyle = INK_HEX
    context.font = SHEET_TYPE.legendCode
    context.fillText(entry.code, itemX + codeOffset, itemY + rowHeight / 2)

    context.fillStyle = MUTED_INK_HEX
    context.font = SHEET_TYPE.legendCount
    context.fillText(legendItemText(entry), itemX + countOffset, itemY + rowHeight / 2)
  })
}

/** 合成一张图纸；要不要下载由调用方决定，标没标色号一并交出去 */
export function drawPatternSheet(input: PatternSheetInput): {
  canvas: HTMLCanvasElement
  labelled: boolean
} {
  const { pattern, palette, beadSize } = input
  const { cols, rows } = pattern.grid
  const entries = legendEntries(pattern, palette)
  const summary = `${cols} × ${rows} 格 · 成品 ${formatPatternSize(patternSizeMm(cols, rows, beadSize))} · 共 ${totalBeads(pattern.grid)} 颗`
  const text = measureTextBlocks(summary, entries)
  const layout = planExportLayout({
    cols,
    rows,
    legendEntryCount: entries.length,
    titleWidth: text.titleWidth,
    legendItemWidth: text.legendItemWidth,
  })

  const canvas = document.createElement('canvas')
  canvas.width = layout.canvas.width
  canvas.height = layout.canvas.height

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('拿不到画布上下文，导出失败')
  }

  context.fillStyle = PAPER_HEX
  context.fillRect(0, 0, canvas.width, canvas.height)

  drawHeader(context, layout, summary)
  drawCells(context, layout, input)
  drawGridLines(context, layout, cols, rows)
  drawCoordinates(context, layout, cols, rows)
  drawLegend(context, layout, entries)

  return { canvas, labelled: layout.labelled }
}
