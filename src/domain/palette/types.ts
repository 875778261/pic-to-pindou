/**
 * 色卡。
 *
 * 色号是下单时唯一可依赖的标识；屏幕色只是豆色的近似。
 */

import { hexToLab, type Lab } from '../colour'

export type BeadCode = string

/** 色卡里一条记录的最小信息，也是数据文件里手写的形态 */
export type PaletteColour = {
  code: BeadCode
  name: string
  hex: string
}

export type PaletteEntry = PaletteColour & {
  /** 在色卡中的下标，与豆格编码 i + 1 对齐 */
  index: number
  lab: Lab
}

export type Palette = {
  id: string
  title: string
  entries: readonly PaletteEntry[]
  byCode: ReadonlyMap<BeadCode, PaletteEntry>
}

/**
 * 把静态色表变成可直接查色差的色卡。
 * LAB 在这里一次算完，转换过程里不再重复计算。
 */
export function createPalette(input: {
  id: string
  title: string
  colours: readonly PaletteColour[]
}): Palette {
  const { id, title, colours } = input
  if (colours.length === 0) {
    throw new Error(`色卡不能为空：${id}`)
  }

  const byCode = new Map<BeadCode, PaletteEntry>()
  const entries = colours.map((colour, index) => {
    if (byCode.has(colour.code)) {
      throw new Error(`色号重复：${colour.code}（色卡 ${id}）`)
    }
    const entry: PaletteEntry = { ...colour, index, lab: hexToLab(colour.hex) }
    byCode.set(colour.code, entry)
    return entry
  })

  return { id, title, entries, byCode }
}
