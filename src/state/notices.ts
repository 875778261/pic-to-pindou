/**
 * 给用户看的提示文案。
 *
 * 转换层只给结构化结果，怎么讲成人话归这里：同一句话不在界面里各写一遍。
 */

import { type BeadSize, patternSizeMm } from '../domain/bead-size'
import type { RejectedConversion } from '../domain/convert'
import { PEGBOARD_SIDE } from '../domain/params'

export function describeRejection(rejection: RejectedConversion, beadSize: BeadSize): string {
  const { requested, limit, requestedBeads } = rejection
  const limitBeads = limit.maxCols * limit.maxRows
  const sizeMm = patternSizeMm(requested.cols, requested.rows, beadSize)
  const sizeLabel = `${(sizeMm.widthMm / 10).toFixed(1)} × ${(sizeMm.heightMm / 10).toFixed(1)} 厘米`
  return (
    `网格 ${requested.cols} × ${requested.rows} = ${requestedBeads} 颗（成品约 ${sizeLabel}），` +
    `超过单边 ${limit.maxCols} 格（${limit.maxCols} × ${limit.maxRows} = ${limitBeads} 颗）的上限。` +
    `建议分图：把原图切成几块分别转换，每块按 ${PEGBOARD_SIDE} × ${PEGBOARD_SIDE} 的拼豆板来摆。`
  )
}
