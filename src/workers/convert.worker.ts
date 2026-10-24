/**
 * 转换 Worker。
 *
 * 采样、量化、映射全部在这里跑，主线程只负责画：200 × 200 的量化在主线程会直接卡住界面。
 */

import { convert } from '../domain/convert'
import { paletteById } from '../domain/palette/registry'
import type { PixelSource } from '../domain/source'
import type { WorkerRequest, WorkerResponse } from './protocol'

type LoadedSource = PixelSource & { sourceId: number }

/** Worker 全局作用域的极小投影，避免为一个文件引入 webworker 那套与 DOM 冲突的 lib */
type WorkerScope = {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null
  postMessage: (message: WorkerResponse, transfer: Transferable[]) => void
}

const scope = self as unknown as WorkerScope

let currentSource: LoadedSource | null = null

scope.onmessage = (event) => {
  const request = event.data

  if (request.type === 'load') {
    currentSource = { sourceId: request.sourceId, ...request.source }
    return
  }

  const respond = (message: WorkerResponse, transfer: Transferable[] = []) =>
    scope.postMessage(message, transfer)

  if (!currentSource || currentSource.sourceId !== request.sourceId) {
    respond({ type: 'failed', requestId: request.requestId, message: '源图还没有送到转换线程' })
    return
  }

  try {
    const outcome = convert({
      source: currentSource,
      params: request.params,
      palette: paletteById(request.params.paletteId),
    })
    const transfer = outcome.status === 'converted' ? [outcome.pattern.grid.cells.buffer] : []
    respond({ type: 'converted', requestId: request.requestId, outcome }, transfer)
  } catch (error) {
    respond({
      type: 'failed',
      requestId: request.requestId,
      message: error instanceof Error ? error.message : '转换失败',
    })
  }
}
