import { describe, expect, it } from 'vitest'
import { colsForRows, GRID_PRESETS, rowsForCols } from './grid-size'

/** 常见手机横拍：3:2 */
const PHOTO_3X2 = { width: 1200, height: 800 }

describe('网格尺寸推导', () => {
  it('四档板数预设各对应一块整板或整块拼起来的板面', () => {
    expect(GRID_PRESETS.map((preset) => `${preset.cols}×${preset.rows}`)).toEqual([
      '29×29',
      '29×58',
      '58×58',
      '87×87',
    ])
    expect(GRID_PRESETS.map((preset) => preset.label)).toEqual(['1 块', '2 块', '4 块', '9 块'])
  })

  it('比例锁定时改宽推高、改高推宽，两条路互为逆运算', () => {
    expect(rowsForCols(30, PHOTO_3X2)).toBe(20)
    expect(colsForRows(20, PHOTO_3X2)).toBe(30)
    expect(rowsForCols(29, PHOTO_3X2)).toBe(19)
    expect(colsForRows(19, PHOTO_3X2)).toBe(29)
  })

  it('极端比例下另一边至少留一格', () => {
    expect(rowsForCols(5, { width: 1000, height: 10 })).toBe(1)
    expect(colsForRows(5, { width: 10, height: 1000 })).toBe(1)
  })
})
