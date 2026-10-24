import { describe, expect, it } from 'vitest'
import { hexToRgb } from '../colour'
import { MARD_221, MARD_291 } from './mard'

describe('MARD 291 色', () => {
  it('色号数量与上游一致', () => {
    expect(MARD_291.entries).toHaveLength(291)
  })

  it('色号无重复', () => {
    const codes = MARD_291.entries.map((entry) => entry.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('每个色号都有合法屏幕色与 LAB', () => {
    for (const entry of MARD_291.entries) {
      expect(() => hexToRgb(entry.hex)).not.toThrow()
      expect(Number.isFinite(entry.lab.l)).toBe(true)
      expect(Number.isFinite(entry.lab.a)).toBe(true)
      expect(Number.isFinite(entry.lab.b)).toBe(true)
    }
  })

  it('下标与数组位置对齐，供豆格编码使用', () => {
    MARD_291.entries.forEach((entry, position) => {
      expect(entry.index).toBe(position)
    })
  })

  it('能按色号查回自身', () => {
    for (const code of ['A1', 'G7', 'P1']) {
      expect(MARD_291.byCode.get(code)?.code).toBe(code)
    }
  })

  it('221 档完整落在 291 之内', () => {
    const fullCodes = new Set(MARD_291.entries.map((entry) => entry.code))
    for (const entry of MARD_221.entries) {
      expect(fullCodes.has(entry.code), `291 缺少 ${entry.code}`).toBe(true)
    }
  })
})

describe('MARD 221 色', () => {
  it('色号数量为 221', () => {
    expect(MARD_221.entries).toHaveLength(221)
  })

  it('是 291 的子集，且同号同色', () => {
    for (const entry of MARD_221.entries) {
      const counterpart = MARD_291.byCode.get(entry.code)
      expect(counterpart, `291 缺少 ${entry.code}`).toBeDefined()
      expect(counterpart?.hex).toBe(entry.hex)
    }
  })

  it('色号无重复', () => {
    const codes = MARD_221.entries.map((entry) => entry.code)
    expect(new Set(codes).size).toBe(codes.length)
  })
})
