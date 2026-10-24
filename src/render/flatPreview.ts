/**
 * 扁平色块预览。
 *
 * 先把网格按「一格一像素」画进离屏画布，再整数倍放大：放大后格边是直边，不会被插值糊掉。
 */

import { hexToRgb } from '../domain/colour'
import { BLANK_CELL, cellAt } from '../domain/grid'
import type { Palette } from '../domain/palette/types'
import { type Pattern, paletteEntryForCell } from '../domain/pattern'

/** 空白格用浅灰打底，和白色豆（G 系列的白）能分开 */
const BLANK_CELL_HEX = '#E5E7EB'

export type PreviewViewport = { width: number; height: number; pixelRatio: number }

export function drawFlatPreview(
  canvas: HTMLCanvasElement,
  pattern: Pattern,
  palette: Palette,
  viewport: PreviewViewport,
): void {
  const { cols, rows } = pattern.grid
  if (viewport.width <= 0 || viewport.height <= 0) {
    return
  }

  const cellSize = Math.max(1, Math.floor(Math.min(viewport.width / cols, viewport.height / rows)))
  const displayWidth = cols * cellSize
  const displayHeight = rows * cellSize

  canvas.style.width = `${displayWidth}px`
  canvas.style.height = `${displayHeight}px`
  canvas.width = Math.max(1, Math.round(displayWidth * viewport.pixelRatio))
  canvas.height = Math.max(1, Math.round(displayHeight * viewport.pixelRatio))

  const context = canvas.getContext('2d')
  if (!context) {
    return
  }

  const flatCanvas = document.createElement('canvas')
  flatCanvas.width = cols
  flatCanvas.height = rows
  const flatContext = flatCanvas.getContext('2d')
  if (!flatContext) {
    return
  }

  const image = flatContext.createImageData(cols, rows)
  const hexByCell = new Map<number, string>()
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const cell = cellAt(pattern.grid, col, row)
      let hex = hexByCell.get(cell)
      if (!hex) {
        hex =
          cell === BLANK_CELL
            ? BLANK_CELL_HEX
            : (paletteEntryForCell(palette, cell)?.hex ?? BLANK_CELL_HEX)
        hexByCell.set(cell, hex)
      }
      const { r, g, b } = hexToRgb(hex)
      const offset = (row * cols + col) * 4
      image.data[offset] = r
      image.data[offset + 1] = g
      image.data[offset + 2] = b
      image.data[offset + 3] = 255
    }
  }
  flatContext.putImageData(image, 0, 0)

  context.imageSmoothingEnabled = false
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.drawImage(flatCanvas, 0, 0, cols, rows, 0, 0, canvas.width, canvas.height)
}
