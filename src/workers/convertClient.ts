/**
 * 转换 Worker 的主线程侧封装。
 *
 * 只认最后一次请求：参数一改就发新请求，旧请求的返回一律作废，不做队列。
 */

import type { ConvertOutcome } from '../domain/convert'
import type { ConvertParams } from '../domain/params'
import type { PixelSource } from '../domain/source'
import type { WorkerResponse } from './protocol'

export type ConvertClientResult =
  | ConvertOutcome
  | { status: 'superseded' }
  | { status: 'failed'; message: string }

export type ConvertClient = {
  /** 换图时调用；像素数组会被移交给 Worker，调用方不要再读它 */
  setSource: (source: PixelSource) => void
  convert: (params: ConvertParams) => Promise<ConvertClientResult>
  dispose: () => void
}

export function createConvertClient(): ConvertClient {
  const worker = new Worker(new URL('./convert.worker.ts', import.meta.url), { type: 'module' })

  let nextRequestId = 1
  let latestRequestId = 0
  let sourceId = 0
  const pending = new Map<number, (result: ConvertClientResult) => void>()

  const settleAllAsSuperseded = () => {
    for (const [requestId, resolve] of pending) {
      pending.delete(requestId)
      resolve({ status: 'superseded' })
    }
  }

  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const response = event.data
    const resolve = pending.get(response.requestId)
    if (!resolve) {
      return
    }
    pending.delete(response.requestId)

    if (response.requestId !== latestRequestId) {
      resolve({ status: 'superseded' })
      return
    }
    resolve(
      response.type === 'converted'
        ? response.outcome
        : { status: 'failed', message: response.message },
    )
  }

  return {
    setSource(source) {
      sourceId += 1
      settleAllAsSuperseded()
      worker.postMessage({ type: 'load', sourceId, source }, [source.pixels.buffer])
    },

    convert(params) {
      const requestId = nextRequestId
      nextRequestId += 1
      latestRequestId = requestId
      settleAllAsSuperseded()

      return new Promise<ConvertClientResult>((resolve) => {
        pending.set(requestId, resolve)
        worker.postMessage({ type: 'convert', requestId, sourceId, params })
      })
    },

    dispose() {
      settleAllAsSuperseded()
      worker.terminate()
    },
  }
}
