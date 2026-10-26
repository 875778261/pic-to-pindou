/**
 * 画到画布上的几种中性色。
 *
 * 预览与导出都要把空白格画成同一个样子：同一格在屏幕上和在图纸上颜色不同，用户会以为那是两回事。
 */

/** 空白格打底的浅灰，和白色豆能分开 */
export const BLANK_CELL_HEX = '#E5E7EB'

/** 豆形预览的板面：豆与豆之间的缝隙露出它 */
export const BOARD_HEX = '#F3F4F6'

/** 豆孔露出的是板钉，比板面深一档才看得出那是孔 */
export const PEG_HEX = '#D1D5DB'

/** 画布上的正文色与次要文字色 */
export const INK_HEX = '#111827'
export const MUTED_INK_HEX = '#6B7280'
