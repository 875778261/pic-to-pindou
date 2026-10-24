import { describe, expect, it } from 'vitest'
import { materialOf, seriesDisplayName, seriesLabel, seriesOf } from './series'

describe('系列推导', () => {
  it('从色号前缀取系列', () => {
    expect(seriesOf('A1')).toBe('A')
    expect(seriesOf('M15')).toBe('M')
    expect(seriesOf('ZG3')).toBe('ZG')
    expect(seriesOf('P23')).toBe('P')
    expect(seriesOf('A10')).toBe('A')
  })

  it('色号没有字母前缀时报错', () => {
    expect(() => seriesOf('123')).toThrow()
    expect(() => seriesOf('')).toThrow()
  })
})

describe('材质判定', () => {
  it('A–M 是标准色', () => {
    for (const code of ['A1', 'D12', 'G7', 'H21', 'M1']) {
      expect(materialOf(code)).toBe('standard')
    }
  })

  it('其余系列是特种色', () => {
    for (const code of ['P1', 'R28', 'ZG8', 'Y5', 'Q1', 'T1']) {
      expect(materialOf(code)).toBe('special')
    }
  })
})

describe('系列显示名', () => {
  it('有可信语义的系列带中文', () => {
    expect(seriesDisplayName('A')).toBe('A 黄橙')
    expect(seriesDisplayName('ZG')).toBe('ZG 珠光')
  })

  it('没有可信语义的系列只出字母，不编造', () => {
    for (const series of ['P', 'R', 'Q', 'T', 'Y']) {
      expect(seriesLabel(series)).toBeUndefined()
      expect(seriesDisplayName(series)).toBe(series)
    }
  })
})
