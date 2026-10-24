import { describe, expect, it } from 'vitest'
import { BEAD_SIZES, beadSizeById, patternSizeMm } from './bead-size'
import { BLANK_CELL, cellAt, countBeads, createBlankGrid, setCell, totalBeads } from './grid'

describe('豆格网格', () => {
  it('新建的网格全是空白格', () => {
    const grid = createBlankGrid(3, 2)
    expect(grid.cells).toHaveLength(6)
    expect(Array.from(grid.cells).every((value) => value === BLANK_CELL)).toBe(true)
  })

  it('按行列写入后能读回同一个值', () => {
    const grid = createBlankGrid(4, 3)
    setCell(grid, 2, 1, 5)
    expect(cellAt(grid, 2, 1)).toBe(5)
    expect(cellAt(grid, 0, 0)).toBe(BLANK_CELL)
  })

  it('拒绝越界坐标', () => {
    const grid = createBlankGrid(2, 2)
    expect(() => setCell(grid, 2, 0, 1)).toThrow()
    expect(() => cellAt(grid, 0, -1)).toThrow()
  })

  it('拒绝非法尺寸', () => {
    expect(() => createBlankGrid(0, 5)).toThrow()
    expect(() => createBlankGrid(3.5, 5)).toThrow()
  })
})

describe('颗数统计', () => {
  // 2 个色号的色卡：1 = 第一个色号，2 = 第二个色号
  const grid = createBlankGrid(3, 2)
  setCell(grid, 0, 0, 1)
  setCell(grid, 1, 0, 1)
  setCell(grid, 2, 0, 1)
  setCell(grid, 0, 1, 2)
  setCell(grid, 1, 1, 2)
  // (2, 1) 留作空白格

  it('按色卡下标统计颗数', () => {
    expect(countBeads(grid, 2)).toEqual([3, 2])
  })

  it('空白格不计入任何色号', () => {
    expect(totalBeads(grid)).toBe(5)
  })

  it('颗数总和等于非空白格数', () => {
    const counts = countBeads(grid, 2)
    expect(counts.reduce((sum, value) => sum + value, 0)).toBe(totalBeads(grid))
  })

  it('全空白网格的颗数为零', () => {
    expect(countBeads(createBlankGrid(5, 5), 3)).toEqual([0, 0, 0])
  })

  it('引用色卡之外的颜色时报错', () => {
    const bad = createBlankGrid(1, 1)
    setCell(bad, 0, 0, 9)
    expect(() => countBeads(bad, 2)).toThrow()
  })
})

describe('豆规格换算', () => {
  it('三种规格都在', () => {
    expect(BEAD_SIZES.map((size) => size.diameterMm)).toEqual([2.6, 5, 10])
  })

  it('成品边长 = 豆格数 × 豆规格', () => {
    const standard = beadSizeById('standard')
    const mini = beadSizeById('mini')
    expect(patternSizeMm(29, 29, standard)).toEqual({ widthMm: 145, heightMm: 145 })
    expect(patternSizeMm(58, 29, mini).widthMm).toBeCloseTo(150.8)
  })

  it('同一网格换规格只改物理尺寸', () => {
    const mini = patternSizeMm(40, 40, beadSizeById('mini'))
    const large = patternSizeMm(40, 40, beadSizeById('large'))
    expect(mini.widthMm).toBeCloseTo(104)
    expect(large.widthMm).toBeCloseTo(400)
  })

  it('拒绝非正数豆规格', () => {
    expect(() => patternSizeMm(10, 10, { id: 'standard', label: '标准', diameterMm: 0 })).toThrow()
  })
})
