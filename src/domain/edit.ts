/**
 * 手改：把一笔涂色落到网格上，以及数出图纸被改过几格。
 *
 * 涂色不改原网格，而是交一张新网格回去——撤销栈存的就是这些互不相干的版本。
 */

import { type BeadGrid, cellIndex } from './grid'

/** 一格要改成什么。index 是行优先下标 */
export type CellPaint = { index: number; value: number }

function assertPaint(grid: BeadGrid, paint: CellPaint): void {
  if (!Number.isInteger(paint.value) || paint.value < 0) {
    throw new Error(`豆格取值必须是非负整数：${paint.value}`)
  }
  if (!Number.isInteger(paint.index) || paint.index < 0 || paint.index >= grid.cells.length) {
    throw new Error(`涂色下标越界：${paint.index}（网格共 ${grid.cells.length} 格）`)
  }
}

/**
 * 一笔涂色（通常是一次按下到抬起划过的所有格）。
 * 没有改动时原样返回同一个网格，调用方可以用引用相等判断「这一笔什么都没做」。
 */
export function paintGrid(grid: BeadGrid, paints: readonly CellPaint[]): BeadGrid {
  const changed = paints.filter((paint) => {
    assertPaint(grid, paint)
    return grid.cells[paint.index] !== paint.value
  })
  if (changed.length === 0) {
    return grid
  }

  const cells = new Uint16Array(grid.cells)
  for (const paint of changed) {
    cells[paint.index] = paint.value
  }
  return { cols: grid.cols, rows: grid.rows, cells }
}

/** 两张同尺寸网格之间实际改了几格，用来说「将丢弃 N 处手改」 */
export function countChangedCells(base: BeadGrid, current: BeadGrid): number {
  if (base.cols !== current.cols || base.rows !== current.rows) {
    throw new Error(
      `网格尺寸不一致：${base.cols} × ${base.rows} 与 ${current.cols} × ${current.rows}`,
    )
  }

  let count = 0
  for (let index = 0; index < base.cells.length; index += 1) {
    if (base.cells[index] !== current.cells[index]) {
      count += 1
    }
  }
  return count
}

/**
 * 两点之间要补的格（不含起点）：指针走快了会跳过中间的格。
 */
export function cellPath(
  grid: BeadGrid,
  from: { col: number; row: number },
  to: { col: number; row: number },
): number[] {
  const steps = Math.max(Math.abs(to.col - from.col), Math.abs(to.row - from.row))
  if (steps === 0) {
    return []
  }

  const path: number[] = []
  for (let step = 1; step <= steps; step += 1) {
    path.push(
      cellIndex(
        grid,
        Math.round(from.col + ((to.col - from.col) * step) / steps),
        Math.round(from.row + ((to.row - from.row) * step) / steps),
      ),
    )
  }
  return path
}
