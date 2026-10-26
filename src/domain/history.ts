/**
 * 撤销栈：把「改前 / 改后」两张图纸排成一条线，指针沿这条线前后移动。
 *
 * 栈里存整张图纸而不是补丁：一次拖动可能涂几十格，记补丁要为每格维护正反两向。
 */

export type History<T> = {
  /** 从旧到新，末尾那张是「当前」的前一步 */
  past: readonly T[]
  present: T
  future: readonly T[]
}

/** 能撤销多少步 */
export const HISTORY_LIMIT = 50

export function startHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] }
}

/** 记一步。新的一步会作废重做分支；栈满时丢最老的一步 */ export function recordStep<T>(
  history: History<T>,
  next: T,
  limit: number = HISTORY_LIMIT,
): History<T> {
  const past = [...history.past, history.present]
  return {
    past: past.length > limit ? past.slice(past.length - limit) : past,
    present: next,
    future: [],
  }
}

/**
 * 顶替当前这张而不记一步：重算的产物直接上场，手改过的旧版本仍留在 past 里可撤
 * （理由见 ADR-0013）。
 */
export function replacePresent<T>(history: History<T>, next: T): History<T> {
  return { past: history.past, present: next, future: [] }
}

export function undoStep<T>(history: History<T>): History<T> {
  const previous = history.past.at(-1)
  if (previous === undefined) {
    return history
  }
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  }
}

export function redoStep<T>(history: History<T>): History<T> {
  const [next, ...rest] = history.future
  if (next === undefined) {
    return history
  }
  return { past: [...history.past, history.present], present: next, future: rest }
}
