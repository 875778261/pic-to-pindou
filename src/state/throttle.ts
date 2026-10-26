/**
 * 重算节流。
 *
 * 按最小间隔合并高频请求，并在间隔末尾补一次，保证最后一次改动一定会被执行到。
 */

export type ThrottledRunner = {
  /** 请求执行；距上次执行不足间隔时合并到间隔末尾 */
  request: () => void
  cancel: () => void
}

export function createThrottledRunner(run: () => void, intervalMs: number): ThrottledRunner {
  let lastRunAt = 0
  let timer: ReturnType<typeof setTimeout> | null = null

  const runNow = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    lastRunAt = Date.now()
    run()
  }

  return {
    request() {
      const elapsedMs = Date.now() - lastRunAt
      if (elapsedMs >= intervalMs) {
        runNow()
        return
      }
      if (timer !== null) {
        return
      }
      timer = setTimeout(runNow, intervalMs - elapsedMs)
    },
    cancel() {
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
    },
  }
}
