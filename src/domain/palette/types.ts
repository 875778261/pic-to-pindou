/**
 * 色卡。
 *
 * 色号是下单时唯一可依赖的标识；屏幕色只是豆色的近似。
 */

import { hexToLab, type Lab } from '../colour'
import { type BeadMaterial, materialOf, seriesOf } from './series'

export type BeadCode = string

/** 色卡里一条记录的最小信息，也是数据文件里手写的形态 */
export type PaletteColour = {
  code: BeadCode
  hex: string
}

export type PaletteEntry = PaletteColour & {
  /** 在色卡中的下标，与豆格编码 i + 1 对齐 */
  index: number
  /** 色号前缀所属的系列，如 A、ZG */
  series: string
  /** 特种色屏幕色不反映实物，不参与量化选色 */
  material: BeadMaterial
  lab: Lab
}

export type Palette = {
  id: string
  title: string
  entries: readonly PaletteEntry[]
  byCode: ReadonlyMap<BeadCode, PaletteEntry>
  /** 量化选色的候选色号，已排除特种色 */
  quantisationCandidates: readonly PaletteEntry[]
}

/**
 * 把静态色表变成可直接查色差的色卡。
 * 系列、材质、LAB 都在这里一次算完，转换过程里不再重复计算。
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
    const entry: PaletteEntry = {
      ...colour,
      index,
      series: seriesOf(colour.code),
      material: materialOf(colour.code),
      lab: hexToLab(colour.hex),
    }
    byCode.set(colour.code, entry)
    return entry
  })

  const quantisationCandidates = entries.filter((entry) => entry.material === 'standard')

  return { id, title, entries, byCode, quantisationCandidates }
}
