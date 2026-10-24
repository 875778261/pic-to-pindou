/**
 * 豆格网格，图纸数据的唯一载体。
 *
 * 编码约定：0 = 空白格；i + 1 = 色卡第 i 项。
 */

/** 空白格的编码值，实物上这一格是拼豆板上露出来的钉 */
export const BLANK_CELL = 0

export type BeadGrid = {
  cols: number
  rows: number
  /** 长度恒为 cols × rows，按行优先排列 */
  cells: Uint16Array
}

function assertGridShape(cols: number, rows: number): void {
  if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols <= 0 || rows <= 0) {
    throw new Error(`网格尺寸必须是正整数：${cols} × ${rows}`)
  }
}

export function createBlankGrid(cols: number, rows: number): BeadGrid {
  assertGridShape(cols, rows)
  return { cols, rows, cells: new Uint16Array(cols * rows) }
}

export function cellIndex(grid: BeadGrid, col: number, row: number): number {
  if (col < 0 || col >= grid.cols || row < 0 || row >= grid.rows) {
    throw new Error(`豆格坐标越界：(${col}, ${row}) 不在 ${grid.cols} × ${grid.rows} 内`)
  }
  return row * grid.cols + col
}

export function cellAt(grid: BeadGrid, col: number, row: number): number {
  return grid.cells[cellIndex(grid, col, row)] ?? BLANK_CELL
}

export function setCell(grid: BeadGrid, col: number, row: number, cellValue: number): void {
  if (!Number.isInteger(cellValue) || cellValue < 0) {
    throw new Error(`豆格取值必须是非负整数：${cellValue}`)
  }
  grid.cells[cellIndex(grid, col, row)] = cellValue
}

/** 非空白格的颗数总和，即这张图纸要摆多少颗豆 */
export function totalBeads(grid: BeadGrid): number {
  let total = 0
  for (const cellValue of grid.cells) {
    if (cellValue !== BLANK_CELL) {
      total += 1
    }
  }
  return total
}

/**
 * 各色号的颗数，下标与色卡下标对齐。
 * 空白格不计入任何色号。
 */
export function countBeads(grid: BeadGrid, paletteSize: number): number[] {
  const counts = new Array<number>(paletteSize).fill(0)
  for (const cellValue of grid.cells) {
    if (cellValue === BLANK_CELL) {
      continue
    }
    const paletteIndex = cellValue - 1
    if (paletteIndex >= paletteSize) {
      throw new Error(`豆格引用了色卡之外的颜色：${cellValue}（色卡共 ${paletteSize} 色）`)
    }
    counts[paletteIndex] = (counts[paletteIndex] ?? 0) + 1
  }
  return counts
}
