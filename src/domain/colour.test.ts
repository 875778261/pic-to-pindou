import { describe, expect, it } from 'vitest'
import { deltaE2000, hexToLab, hexToRgb, type Lab, rgbToHex } from './colour'

/**
 * Sharma、Wu、Dalal（2005）公布的 CIEDE2000 参考数据，共 34 组。
 * 这组数据专门用来卡实现里的色相折返与旋转项，是实现正确性的外部依据。
 */
const SHARMA_PAIRS: ReadonlyArray<{ first: Lab; second: Lab; expected: number }> = [
  {
    first: { l: 50, a: 2.6772, b: -79.7751 },
    second: { l: 50, a: 0, b: -82.7485 },
    expected: 2.0425,
  },
  {
    first: { l: 50, a: 3.1571, b: -77.2803 },
    second: { l: 50, a: 0, b: -82.7485 },
    expected: 2.8615,
  },
  {
    first: { l: 50, a: 2.8361, b: -74.02 },
    second: { l: 50, a: 0, b: -82.7485 },
    expected: 3.4412,
  },
  {
    first: { l: 50, a: -1.3802, b: -84.2814 },
    second: { l: 50, a: 0, b: -82.7485 },
    expected: 1.0,
  },
  {
    first: { l: 50, a: -1.1848, b: -84.8006 },
    second: { l: 50, a: 0, b: -82.7485 },
    expected: 1.0,
  },
  {
    first: { l: 50, a: -0.9009, b: -85.5211 },
    second: { l: 50, a: 0, b: -82.7485 },
    expected: 1.0,
  },
  { first: { l: 50, a: 0, b: 0 }, second: { l: 50, a: -1, b: 2 }, expected: 2.3669 },
  { first: { l: 50, a: -1, b: 2 }, second: { l: 50, a: 0, b: 0 }, expected: 2.3669 },
  {
    first: { l: 50, a: 2.49, b: -0.001 },
    second: { l: 50, a: -2.49, b: 0.0009 },
    expected: 7.1792,
  },
  { first: { l: 50, a: 2.49, b: -0.001 }, second: { l: 50, a: -2.49, b: 0.001 }, expected: 7.1792 },
  {
    first: { l: 50, a: 2.49, b: -0.001 },
    second: { l: 50, a: -2.49, b: 0.0011 },
    expected: 7.2195,
  },
  {
    first: { l: 50, a: 2.49, b: -0.001 },
    second: { l: 50, a: -2.49, b: 0.0012 },
    expected: 7.2195,
  },
  {
    first: { l: 50, a: -0.001, b: 2.49 },
    second: { l: 50, a: 0.0009, b: -2.49 },
    expected: 4.8045,
  },
  { first: { l: 50, a: -0.001, b: 2.49 }, second: { l: 50, a: 0.001, b: -2.49 }, expected: 4.8045 },
  {
    first: { l: 50, a: -0.001, b: 2.49 },
    second: { l: 50, a: 0.0011, b: -2.49 },
    expected: 4.7461,
  },
  { first: { l: 50, a: 2.5, b: 0 }, second: { l: 50, a: 0, b: -2.5 }, expected: 4.3065 },
  { first: { l: 50, a: 2.5, b: 0 }, second: { l: 73, a: 25, b: -18 }, expected: 27.1492 },
  { first: { l: 50, a: 2.5, b: 0 }, second: { l: 61, a: -5, b: 29 }, expected: 22.8977 },
  { first: { l: 50, a: 2.5, b: 0 }, second: { l: 56, a: -27, b: -3 }, expected: 31.903 },
  { first: { l: 50, a: 2.5, b: 0 }, second: { l: 58, a: 24, b: 15 }, expected: 19.4535 },
  { first: { l: 50, a: 2.5, b: 0 }, second: { l: 50, a: 3.1736, b: 0.5854 }, expected: 1.0 },
  { first: { l: 50, a: 2.5, b: 0 }, second: { l: 50, a: 3.2972, b: 0 }, expected: 1.0 },
  { first: { l: 50, a: 2.5, b: 0 }, second: { l: 50, a: 1.8634, b: 0.5757 }, expected: 1.0 },
  { first: { l: 50, a: 2.5, b: 0 }, second: { l: 50, a: 3.2592, b: 0.335 }, expected: 1.0 },
  {
    first: { l: 60.2574, a: -34.0099, b: 36.2677 },
    second: { l: 60.4626, a: -34.1751, b: 39.4387 },
    expected: 1.2644,
  },
  {
    first: { l: 63.0109, a: -31.0961, b: -5.8663 },
    second: { l: 62.8187, a: -29.7946, b: -4.0864 },
    expected: 1.263,
  },
  {
    first: { l: 61.2901, a: 3.7196, b: -5.3901 },
    second: { l: 61.4292, a: 2.248, b: -4.962 },
    expected: 1.8731,
  },
  {
    first: { l: 35.0831, a: -44.1164, b: 3.7933 },
    second: { l: 35.0232, a: -40.0716, b: 1.5901 },
    expected: 1.8645,
  },
  {
    first: { l: 22.7233, a: 20.0904, b: -46.694 },
    second: { l: 23.0331, a: 14.973, b: -42.5619 },
    expected: 2.0373,
  },
  {
    first: { l: 36.4612, a: 47.858, b: 18.3852 },
    second: { l: 36.2715, a: 50.5065, b: 21.2231 },
    expected: 1.4146,
  },
  {
    first: { l: 90.8027, a: -2.0831, b: 1.441 },
    second: { l: 91.1528, a: -1.6435, b: 0.0447 },
    expected: 1.4441,
  },
  {
    first: { l: 90.9257, a: -0.5406, b: -0.9208 },
    second: { l: 88.6381, a: -0.8985, b: -0.7239 },
    expected: 1.5381,
  },
  {
    first: { l: 6.7747, a: -0.2908, b: -2.4247 },
    second: { l: 5.8714, a: -0.0985, b: -2.2286 },
    expected: 0.6377,
  },
  {
    first: { l: 2.0776, a: 0.0795, b: -1.135 },
    second: { l: 0.9033, a: -0.0636, b: -0.5514 },
    expected: 0.9082,
  },
]

describe('CIEDE2000', () => {
  it.each(SHARMA_PAIRS.map((pair, index) => ({ index: index + 1, ...pair })))(
    '参考数据第 $index 组',
    ({ first, second, expected }) => {
      expect(deltaE2000(first, second)).toBeCloseTo(expected, 4)
    },
  )

  it('同一颜色色差为零', () => {
    const lab = hexToLab('#3F7E2C')
    expect(deltaE2000(lab, lab)).toBe(0)
  })

  it('距离对称', () => {
    const left = hexToLab('#B15533')
    const right = hexToLab('#C58B68')
    expect(deltaE2000(left, right)).toBeCloseTo(deltaE2000(right, left), 10)
  })

  it('相近色差小于明显不同色', () => {
    const sand = hexToLab('#EAA794')
    const nearSand = hexToLab('#E8A08D')
    const black = hexToLab('#000000')
    const nearDistance = deltaE2000(sand, nearSand)
    expect(nearDistance).toBeGreaterThan(0)
    expect(nearDistance).toBeLessThan(deltaE2000(sand, black))
  })
})

describe('屏幕色与十六进制互转', () => {
  it('十六进制往返不变', () => {
    for (const hex of ['#000000', '#FFFFFF', '#B15533', '#0A7C3E']) {
      expect(rgbToHex(hexToRgb(hex))).toBe(hex)
    }
  })

  it('接受小写与缺省井号', () => {
    expect(hexToRgb('ffffff')).toEqual({ r: 255, g: 255, b: 255 })
  })

  it('拒绝非法屏幕色', () => {
    expect(() => hexToRgb('#FFF')).toThrow()
    expect(() => hexToRgb('#GGGGGG')).toThrow()
  })

  it('白与黑的 LAB 落在标准位置', () => {
    const white = hexToLab('#FFFFFF')
    expect(white.l).toBeCloseTo(100, 1)
    expect(white.a).toBeCloseTo(0, 2)
    expect(white.b).toBeCloseTo(0, 2)

    const black = hexToLab('#000000')
    expect(black.l).toBeCloseTo(0, 4)
  })

  it('中性灰的 a、b 接近零', () => {
    const gray = hexToLab('#808080')
    expect(Math.abs(gray.a)).toBeLessThan(0.5)
    expect(Math.abs(gray.b)).toBeLessThan(0.5)
  })
})
