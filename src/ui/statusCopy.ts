/**
 * 画布上的占位文案：还没出图纸时，画布中间说什么。
 *
 * 文案不提「左边 / 右边」这类方位：窄屏下参数收在底部抽屉里。
 */

import type { ConvertStatus } from '../state/store'

export const CANVAS_PLACEHOLDER: Record<ConvertStatus, string> = {
  idle: '还没有图片。选一张，或者把图直接拖进来。',
  loading: '正在读图…',
  converting: '正在把图片变成豆格…',
  ready: '预览出问题了，换一张图试试。',
  rejected: '这张图没有转成图纸，原因在参数区。',
  failed: '这张图没有转成图纸，原因在参数区。',
}
