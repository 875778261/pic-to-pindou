/**
 * 单颗豆的离屏模板。
 *
 * 同一色号同一尺寸只画一次，之后每格一次 drawImage（ADR-0003）。
 */

import { PEG_HEX } from './colours'

/** 豆身直径占一格的比例，剩下的就是豆间缝隙 */
const BODY_RATIO = 0.88
/** 豆孔直径占豆身的比例 */
const HOLE_RATIO = 0.3
/** 豆身边缘压深一档，圆豆才有厚度 */
const RIM_ALPHA = 0.14
/** 空白格的钉环半径占一格的比例 */
const PEG_RING_RATIO = 0.3

const templates = new Map<string, HTMLCanvasElement>()

/** 缩放手势会不断产生新的整格尺寸，缓存到上限就整体清掉，不做 LRU */
const TEMPLATE_CACHE_LIMIT = 512

function paintTemplate(hex: string, size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) {
    return canvas
  }

  const centre = size / 2
  const bodyRadius = (size * BODY_RATIO) / 2

  context.beginPath()
  context.arc(centre, centre, bodyRadius, 0, Math.PI * 2)
  context.fillStyle = hex
  context.fill()

  context.beginPath()
  context.arc(
    centre,
    centre,
    Math.max(0.5, bodyRadius - Math.max(1, size * 0.06) / 2),
    0,
    Math.PI * 2,
  )
  context.strokeStyle = `rgba(0, 0, 0, ${RIM_ALPHA})`
  context.lineWidth = Math.max(1, size * 0.06)
  context.stroke()

  context.beginPath()
  context.arc(centre, centre, Math.max(0.5, bodyRadius * HOLE_RATIO), 0, Math.PI * 2)
  context.fillStyle = PEG_HEX
  context.fill()

  return canvas
}

/** 某个色号、某个格宽的豆形模板；尺寸按整数格宽缓存 */
export function beadTemplate(hex: string, cellSize: number): HTMLCanvasElement {
  const size = Math.max(1, Math.round(cellSize))
  const key = `${hex}|${size}`
  const cached = templates.get(key)
  if (cached) {
    return cached
  }

  const template = paintTemplate(hex, size)
  if (templates.size >= TEMPLATE_CACHE_LIMIT) {
    templates.clear()
  }
  templates.set(key, template)
  return template
}

/**
 * 空白格：只有一圈钉环，没有豆身。
 * 与导出图纸的空心圆同一套语义（ADR-0008），和实心白豆一眼分得开。
 */
export function paintPeg(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  cellSize: number,
): void {
  context.beginPath()
  context.arc(x + cellSize / 2, y + cellSize / 2, cellSize * PEG_RING_RATIO, 0, Math.PI * 2)
  context.strokeStyle = PEG_HEX
  context.lineWidth = Math.max(1, cellSize * 0.12)
  context.stroke()
}
