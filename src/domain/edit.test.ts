import { describe, expect, it } from 'vitest'
import { cellPath, countChangedCells, paintGrid } from './edit'
import { BLANK_CELL, cellAt, createBlankGrid, setCell } from './grid'

describe('涂色', () => {
  it('一笔改一格，原网格不动', () => {
    const grid = createBlankGrid(3, 2)
    const painted = paintGrid(grid, [{ index: 4, value: 3 }])

    expect(cellAt(painted, 1, 1)).toBe(3)
    expect(cellAt(grid, 1, 1)).toBe(BLANK_CELL)
  })

  it('一笔改多格，按行优先下标落位', () => {
    const grid = createBlankGrid(4, 1)
    const painted = paintGrid(grid, [
      { index: 0, value: 1 },
      { index: 3, value: 7 },
    ])

    expect([...painted.cells]).toEqual([1, 0, 0, 7])
  })

  it('同一笔里后面的值覆盖前面的，涂色不会来回跳', () => {
    const grid = createBlankGrid(2, 1)
    const painted = paintGrid(grid, [
      { index: 0, value: 2 },
      { index: 0, value: 5 },
    ])

    expect(painted.cells[0]).toBe(5)
  })

  it('涂成空白格就是橡皮', () => {
    const grid = createBlankGrid(2, 1)
    setCell(grid, 0, 0, 9)

    const painted = paintGrid(grid, [{ index: 0, value: BLANK_CELL }])
    expect(painted.cells[0]).toBe(BLANK_CELL)
  })

  it('下标越界直接报错，不静默丢格', () => {
    const grid = createBlankGrid(2, 2)
    expect(() => paintGrid(grid, [{ index: 4, value: 1 }])).toThrow()
    expect(() => paintGrid(grid, [{ index: -1, value: 1 }])).toThrow()
  })

  it('取值必须是非负整数', () => {
    const grid = createBlankGrid(1, 1)
    expect(() => paintGrid(grid, [{ index: 0, value: -1 }])).toThrow()
    expect(() => paintGrid(grid, [{ index: 0, value: 1.5 }])).toThrow()
  })

  it('一张空网格原样返回自己，不必为不存在的改动造新对象', () => {
    const grid = createBlankGrid(3, 3)
    expect(paintGrid(grid, [])).toBe(grid)
  })
})

describe('拖动补格', () => {
  it('还在同一格时不用补', () => {
    const grid = createBlankGrid(5, 5)
    expect(cellPath(grid, { col: 2, row: 2 }, { col: 2, row: 2 })).toEqual([])
  })

  it('相邻两格只补目标那一格', () => {
    const grid = createBlankGrid(5, 5)
    expect(cellPath(grid, { col: 1, row: 0 }, { col: 2, row: 0 })).toEqual([2])
  })

  it('横向跨三格补中间两格，不漏涂', () => {
    const grid = createBlankGrid(6, 1)
    expect(cellPath(grid, { col: 0, row: 0 }, { col: 3, row: 0 })).toEqual([1, 2, 3])
  })

  it('斜向跨格按最长的那个方向步进', () => {
    const grid = createBlankGrid(4, 4)
    // 从 (0,0) 到 (2,1)：横跨 2 步，补 (1,1) 与 (2,1)
    expect(cellPath(grid, { col: 0, row: 0 }, { col: 2, row: 1 })).toEqual([5, 6])
  })

  it('落到网格外直接报错，不静默截断', () => {
    const grid = createBlankGrid(3, 3)
    expect(() => cellPath(grid, { col: 0, row: 0 }, { col: 3, row: 0 })).toThrow()
  })
})

describe('手改计数', () => {
  it('数出两张网格之间差了几格', () => {
    const base = createBlankGrid(3, 1)
    const edited = paintGrid(base, [
      { index: 0, value: 2 },
      { index: 2, value: 4 },
    ])

    expect(countChangedCells(base, edited)).toBe(2)
  })

  it('涂成同一颜色不算改过', () => {
    const base = createBlankGrid(2, 1)
    setCell(base, 0, 0, 3)

    const same = paintGrid(base, [{ index: 0, value: 3 }])
    expect(countChangedCells(base, same)).toBe(0)
  })

  it('涂成空白格也算一处改动', () => {
    const base = createBlankGrid(2, 1)
    setCell(base, 1, 0, 3)

    expect(countChangedCells(base, paintGrid(base, [{ index: 1, value: BLANK_CELL }]))).toBe(1)
  })

  it('尺寸不一致报错，不拿两张不同图纸硬比', () => {
    expect(() => countChangedCells(createBlankGrid(2, 2), createBlankGrid(3, 3))).toThrow()
  })
})
