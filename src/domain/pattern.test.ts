import { describe, expect, it } from 'vitest'
import { createBlankGrid, setCell, totalBeads } from './grid'
import { MARD_221, MARD_291 } from './palette/mard'
import {
  cellFitsCode,
  createPattern,
  legendEntries,
  MIN_CODE_CELL_SIZE,
  patternBelongsTo,
} from './pattern'

describe('图纸', () => {
  it('颗数与色号由网格和色卡推出', () => {
    const grid = createBlankGrid(3, 1)
    setCell(grid, 0, 0, 1) // 色卡第 0 项
    setCell(grid, 1, 0, 1)
    setCell(grid, 2, 0, 2) // 色卡第 1 项

    const pattern = createPattern(MARD_291, grid)
    expect(pattern.paletteId).toBe(MARD_291.id)
    expect(pattern.counts).toHaveLength(MARD_291.entries.length)
    expect(pattern.counts[0]).toBe(2)
    expect(pattern.counts[1]).toBe(1)
    expect(pattern.usedCodes).toEqual([MARD_291.entries[0]?.code, MARD_291.entries[1]?.code])
  })

  it('空白格不进颗数也不进用到的色号', () => {
    const grid = createBlankGrid(2, 1)
    setCell(grid, 1, 0, 3)

    const pattern = createPattern(MARD_291, grid)
    expect(totalBeads(grid)).toBe(1)
    expect(pattern.counts.reduce((sum, value) => sum + value, 0)).toBe(1)
    expect(pattern.usedCodes).toHaveLength(1)
  })

  it('全空白网格没有用到的色号', () => {
    const pattern = createPattern(MARD_291, createBlankGrid(4, 4))
    expect(pattern.usedCodes).toEqual([])
    expect(pattern.counts.every((value) => value === 0)).toBe(true)
  })

  it('用到的色号按色卡下标升序', () => {
    const grid = createBlankGrid(3, 1)
    setCell(grid, 0, 0, 5)
    setCell(grid, 1, 0, 2)
    setCell(grid, 2, 0, 9)

    const pattern = createPattern(MARD_291, grid)
    const indexes = pattern.usedCodes.map((code) => MARD_291.byCode.get(code)?.index)
    expect(indexes).toEqual([1, 4, 8])
  })

  it('标准色在两档中的下标相同', () => {
    for (const entry of MARD_221.entries) {
      expect(MARD_291.byCode.get(entry.code)?.index, entry.code).toBe(entry.index)
    }
  })

  it('291 的图纸配 221 的色卡会越界，靠档位配对拦住', () => {
    const grid = createBlankGrid(1, 1)
    // 第 230 项在 291 里存在，在 221 里越界
    setCell(grid, 0, 0, 230)

    const pattern = createPattern(MARD_291, grid)
    expect(patternBelongsTo(pattern, MARD_221)).toBe(false)
    expect(() => createPattern(MARD_221, grid)).toThrow()
  })

  it('图纸认得出自己不属于哪张色卡', () => {
    const pattern = createPattern(MARD_221, createBlankGrid(2, 2))
    expect(patternBelongsTo(pattern, MARD_221)).toBe(true)
    expect(patternBelongsTo(pattern, MARD_291)).toBe(false)
  })
})

describe('图例', () => {
  it('按颗数降序，同颗数按色卡顺序', () => {
    const grid = createBlankGrid(5, 1)
    setCell(grid, 0, 0, 3)
    setCell(grid, 1, 0, 3)
    setCell(grid, 2, 0, 3)
    setCell(grid, 3, 0, 5)
    setCell(grid, 4, 0, 1)

    const entries = legendEntries(createPattern(MARD_291, grid), MARD_291)
    expect(entries.map((entry) => entry.code)).toEqual([
      MARD_291.entries[2]?.code,
      MARD_291.entries[0]?.code,
      MARD_291.entries[4]?.code,
    ])
    expect(entries.map((entry) => entry.count)).toEqual([3, 1, 1])
  })

  it('每项带色号、颗数与原色，不带名称', () => {
    const grid = createBlankGrid(2, 1)
    setCell(grid, 0, 0, 1)
    setCell(grid, 1, 0, 1)

    const [first] = legendEntries(createPattern(MARD_291, grid), MARD_291)
    const entry = MARD_291.entries[0]
    expect(first).toEqual({
      code: entry?.code,
      count: 2,
      hex: entry?.hex,
    })
  })

  it('空白格不进图例', () => {
    const grid = createBlankGrid(2, 1)
    setCell(grid, 0, 0, 2)

    const entries = legendEntries(createPattern(MARD_291, grid), MARD_291)
    expect(entries).toHaveLength(1)
    expect(entries[0]?.code).toBe(MARD_291.entries[1]?.code)
  })

  it('同一张图纸两次算出完全一样的图例', () => {
    const grid = createBlankGrid(4, 2)
    for (let index = 0; index < grid.cells.length; index += 1) {
      grid.cells[index] = (index % 4) + 1
    }

    const pattern = createPattern(MARD_291, grid)
    expect(legendEntries(pattern, MARD_291)).toEqual(legendEntries(pattern, MARD_291))
  })

  it('色卡档位对不上时不硬算，直接报错', () => {
    const pattern = createPattern(MARD_291, createBlankGrid(1, 1))
    expect(() => legendEntries(pattern, MARD_221)).toThrow()
  })
})

describe('格内色号的可读宽度', () => {
  it('格宽到可读下限才标，差一像素就不标', () => {
    expect(MIN_CODE_CELL_SIZE).toBe(14)
    expect(cellFitsCode(13)).toBe(false)
    expect(cellFitsCode(14)).toBe(true)
    expect(cellFitsCode(24)).toBe(true)
  })

  it('判定只看格宽，与格数无关', () => {
    // 200 × 200 只要格子还够宽就照样标，格数不该进这条判定
    expect(cellFitsCode(200)).toBe(true)
    expect(cellFitsCode(4)).toBe(false)
  })
})
