/**
 * 宽高比的简写。1200 × 800 写作 3:2；化简后数字仍然太大就退回小数比。
 */

function greatestCommonDivisor(left: number, right: number): number {
  return right === 0 ? left : greatestCommonDivisor(right, left % right)
}

export function ratioLabel(width: number, height: number): string {
  const divisor = greatestCommonDivisor(width, height)
  const shortWidth = width / divisor
  const shortHeight = height / divisor
  if (shortWidth <= 40 && shortHeight <= 40) {
    return `${shortWidth}:${shortHeight}`
  }
  return `${(width / height).toFixed(2)}:1`
}
