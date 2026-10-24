/**
 * 主线程与转换 Worker 之间的消息协议。
 *
 * 源图只送一次（load），之后每次转换只送参数：拉滑块会高频触发，重复搬像素纯属浪费。
 */

import type { ConvertOutcome } from '../domain/convert'
import type { ConvertParams } from '../domain/params'
import type { PixelSource } from '../domain/source'

export type LoadRequest = {
  type: 'load'
  /** 换图时递增，Worker 只留最新一张 */
  sourceId: number
  source: PixelSource
}

export type ConvertRequest = {
  type: 'convert'
  /** 单调递增，过期结果直接丢弃 */
  requestId: number
  sourceId: number
  params: ConvertParams
}

export type WorkerRequest = LoadRequest | ConvertRequest

export type WorkerResponse =
  | { type: 'converted'; requestId: number; outcome: ConvertOutcome }
  | { type: 'failed'; requestId: number; message: string }
