/**
 * 转换状态。
 *
 * 只存界面要用的结果，不存源图像素：像素很快就被移交给 Worker，主线程留着只是白占内存。
 */

import { create } from 'zustand'
import { type ConvertParams, defaultConvertParams } from '../domain/params'
import type { Pattern } from '../domain/pattern'
import { createConvertClient } from '../workers/convertClient'
import { loadImageFile } from './loadImageFile'
import { describeRejection } from './notices'

export type ConvertStatus = 'idle' | 'loading' | 'converting' | 'ready' | 'rejected' | 'failed'

export type SourceInfo = { fileName: string; width: number; height: number }

type ConversionStore = {
  params: ConvertParams
  source: SourceInfo | null
  pattern: Pattern | null
  status: ConvertStatus
  /** 给用户看的一句话：被拒绝的原因、读图失败的原因 */
  notice: string | null
  loadFile: (file: File) => Promise<void>
}

const convertClient = createConvertClient()

/**
 * 换图可能重叠：前一张图的解码还没回来，用户已经选了下一张。
 * 只有最后一次加载的结果算数，否则慢的那张会把新图盖掉。
 */
let loadSequence = 0

export const useConversion = create<ConversionStore>((set, get) => ({
  params: defaultConvertParams(),
  source: null,
  pattern: null,
  status: 'idle',
  notice: null,

  async loadFile(file) {
    loadSequence += 1
    const sequence = loadSequence
    set({ status: 'loading', notice: null, pattern: null })

    const loaded = await loadImageFile(file)
    if (sequence !== loadSequence) {
      return
    }
    if (loaded.status === 'failed') {
      set({ status: 'failed', notice: loaded.message, source: null })
      return
    }

    convertClient.setSource(loaded.source)
    set({
      status: 'converting',
      source: {
        fileName: loaded.source.fileName,
        width: loaded.source.width,
        height: loaded.source.height,
      },
    })

    const result = await convertClient.convert(get().params)
    if (sequence !== loadSequence || result.status === 'superseded') {
      return
    }
    if (result.status === 'converted') {
      set({ status: 'ready', pattern: result.pattern, notice: null })
      return
    }
    if (result.status === 'rejected') {
      set({ status: 'rejected', pattern: null, notice: describeRejection(result) })
      return
    }
    set({ status: 'failed', pattern: null, notice: result.message })
  },
}))
