/**
 * 色卡档位登记。
 *
 * 网格只存色卡下标，所以任何一步拿到网格都必须同时拿到它所属的档位。
 */

import { MARD_221, MARD_291 } from './mard'
import type { Palette } from './types'

export const PALETTE_TIERS: readonly Palette[] = [MARD_291, MARD_221]

/**
 * 默认档位取全系。
 * 两档共享同一批标准色下标，量化候选集也相同，所以默认档位不影响产出色号。
 */
export const DEFAULT_PALETTE_ID = MARD_291.id

export function paletteById(paletteId: string): Palette {
  const found = PALETTE_TIERS.find((palette) => palette.id === paletteId)
  if (!found) {
    throw new Error(`未知的色卡档位：${paletteId}`)
  }
  return found
}
