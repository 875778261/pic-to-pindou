/**
 * 预览绘制：豆形与扁平两套画法，共用一份视口摆放。
 *
 * 坐标、格宽、可见范围都从 `placement()` 来，两种画法只在「怎么落一颗豆」上不同（ADR-0003）。
 */

import { hexToRgb } from '../domain/colour'
import { BLANK_CELL, cellAt } from '../domain/grid'
import type { Palette } from '../domain/palette/types'
import { type Pattern, paletteEntryForCell } from '../domain/pattern'
import {
  cellRect,
  type Placement,
  type PreviewStyle,
  placement,
  usesBeads,
  type Viewport,
} from '../domain/viewport'
import { beadTemplate, paintPeg } from './bead'
import { BLANK_CELL_HEX, BOARD_HEX } from './colours'

export type PreviewInput = {
  pattern: Pattern
  palette: Palette
  style: PreviewStyle
  view: Viewport
  pixelRatio: number
}

export type PreviewFrame = {
  /** 这一帧实际用的是哪套画法：豆形在格太小时会自动降级成扁平 */
  drawnWith: PreviewStyle
  cellSize: number
}

type Range = { from: number; to: number }

/** 落在画布上的是第几列到第几列、第几行到第几行 */
function visibleRange(length: number, origin: number, cellSize: number, extent: number): Range {
  return {
    from: Math.max(0, Math.floor(-origin / cellSize)),
    to: Math.min(length, Math.ceil((extent - origin) / cellSize)),
  }
}

type VisibleArea = { columns: Range; rows: Range }

function visibleArea(input: PreviewInput, placed: Placement): VisibleArea {
  const { cols, rows } = input.pattern.grid
  const { width, height } = input.view
  return {
    columns: visibleRange(cols, placed.originX, placed.cellSize, width),
    rows: visibleRange(rows, placed.originY, placed.cellSize, height),
  }
}

/** 一格一像素的离屏图，再按当前摆放放大：格边是直边，不会被插值糊掉 */
const flatLayers = new WeakMap<Pattern, HTMLCanvasElement>()

function flatLayer(input: PreviewInput): HTMLCanvasElement | null {
  const cached = flatLayers.get(input.pattern)
  if (cached) {
    return cached
  }

  const { pattern, palette } = input
  const { cols, rows } = pattern.grid
  const layer = document.createElement('canvas')
  layer.width = cols
  layer.height = rows
  const layerContext = layer.getContext('2d')
  if (!layerContext) {
    return null
  }

  const image = layerContext.createImageData(cols, rows)
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const cell = cellAt(pattern.grid, col, row)
      const hex =
        cell === BLANK_CELL
          ? BLANK_CELL_HEX
          : (paletteEntryForCell(palette, cell)?.hex ?? BLANK_CELL_HEX)
      const { r, g, b } = hexToRgb(hex)
      const offset = (row * cols + col) * 4
      image.data[offset] = r
      image.data[offset + 1] = g
      image.data[offset + 2] = b
      image.data[offset + 3] = 255
    }
  }
  layerContext.putImageData(image, 0, 0)
  flatLayers.set(pattern, layer)
  return layer
}

function drawFlat(context: CanvasRenderingContext2D, input: PreviewInput, placed: Placement): void {
  const layer = flatLayer(input)
  if (!layer) {
    return
  }
  const { cols, rows } = input.pattern.grid
  context.imageSmoothingEnabled = false
  context.drawImage(
    layer,
    0,
    0,
    cols,
    rows,
    placed.originX,
    placed.originY,
    cols * placed.cellSize,
    rows * placed.cellSize,
  )
}

function drawBeads(
  context: CanvasRenderingContext2D,
  input: PreviewInput,
  placed: Placement,
  area: VisibleArea,
): void {
  const { pattern, palette } = input
  for (let row = area.rows.from; row < area.rows.to; row += 1) {
    for (let col = area.columns.from; col < area.columns.to; col += 1) {
      const { x, y, size } = cellRect(placed, col, row)
      const entry = paletteEntryForCell(palette, cellAt(pattern.grid, col, row))
      if (!entry) {
        paintPeg(context, x, y, size)
        continue
      }
      context.drawImage(beadTemplate(entry.hex, size), x, y, size, size)
    }
  }
}

/** 把图纸画到预览画布上，返回这一帧实际用了哪套画法 */
export function drawPreview(canvas: HTMLCanvasElement, input: PreviewInput): PreviewFrame {
  const { view, pixelRatio } = input
  const placed = placement(view)
  const drawnWith: PreviewStyle = usesBeads(input.style, placed.cellSize) ? 'bead' : 'flat'

  canvas.style.width = `${view.width}px`
  canvas.style.height = `${view.height}px`
  canvas.width = Math.max(1, Math.round(view.width * pixelRatio))
  canvas.height = Math.max(1, Math.round(view.height * pixelRatio))

  const context = canvas.getContext('2d')
  if (!context) {
    return { drawnWith, cellSize: placed.cellSize }
  }

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  context.clearRect(0, 0, view.width, view.height)
  context.fillStyle = BOARD_HEX
  context.fillRect(0, 0, view.width, view.height)

  if (drawnWith === 'bead') {
    drawBeads(context, input, placed, visibleArea(input, placed))
  } else {
    drawFlat(context, input, placed)
  }

  return { drawnWith, cellSize: placed.cellSize }
}
