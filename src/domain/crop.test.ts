import { describe, expect, it } from 'vitest'
import { cropRegion, cropShare } from './crop'

/** 常见手机横拍：3:2 */
const PHOTO_3X2 = { width: 1200, height: 800 }

describe('裁切', () => {
  it('3:2 装进方网格时裁宽度方向，居中对称、裁掉三分之一', () => {
    const region = cropRegion(PHOTO_3X2, 29, 29, 'crop')

    expect(region.width).toBe(800)
    expect(region.height).toBe(800)
    expect(region.x).toBe(200)
    expect(region.y).toBe(0)
    expect(cropShare(29, 29, PHOTO_3X2)).toBeCloseTo(1 / 3, 5)
  })

  it('竖图装进横网格时裁高度方向', () => {
    const region = cropRegion({ width: 800, height: 1200 }, 58, 29, 'crop')

    expect(region.width).toBe(800)
    expect(region.height).toBe(400)
    expect(region.y).toBe(400)
    expect(region.x).toBe(0)
    expect(cropShare(58, 29, { width: 800, height: 1200 })).toBeCloseTo(2 / 3, 5)
  })

  it('比例一致时一格不裁，占比为零', () => {
    const region = cropRegion(PHOTO_3X2, 30, 20, 'crop')

    expect(region).toEqual({ x: 0, y: 0, width: 1200, height: 800 })
    expect(cropShare(30, 20, PHOTO_3X2)).toBe(0)
  })

  it('铺满时始终用整张源图', () => {
    expect(cropRegion(PHOTO_3X2, 29, 29, 'fill')).toEqual({
      x: 0,
      y: 0,
      width: 1200,
      height: 800,
    })
  })

  it('裁出来的区域再裁一次不再变化，说明百分比与真实剪裁同源', () => {
    const once = cropRegion(PHOTO_3X2, 29, 29, 'crop')
    const twice = cropRegion(once, 29, 29, 'crop')

    expect(twice).toEqual({ x: 0, y: 0, width: once.width, height: once.height })
    expect(cropShare(29, 29, once)).toBe(0)
  })
})
