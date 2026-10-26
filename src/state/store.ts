/**
 * 转换状态。
 *
 * 只存界面要用的结果，不存源图像素：像素很快就被移交给 Worker，主线程留着只是白占内存。
 * 参数改动先过节流再重算。
 */

import { create } from 'zustand'
import { type BeadSizeId, beadSizeById } from '../domain/bead-size'
import { colsForRows, GRID_PRESETS, rowsForCols } from '../domain/grid-size'
import type { BeadCode } from '../domain/palette/types'
import { type ConvertFit, type ConvertParams, defaultConvertParams } from '../domain/params'
import type { Pattern } from '../domain/pattern'
import { createConvertClient } from '../workers/convertClient'
import { loadImageFile } from './loadImageFile'
import { describeRejection } from './notices'
import { createThrottledRunner } from './throttle'

export type ConvertStatus = 'idle' | 'loading' | 'converting' | 'ready' | 'rejected' | 'failed'

export type SourceInfo = { fileName: string; width: number; height: number }

/** 可经由面板自由改动的参数；尺寸与装图方式另有专门入口，免得绕过比例推算 */
export type TunableParams = Partial<
  Pick<ConvertParams, 'maxColours' | 'dither' | 'brightness' | 'contrast' | 'saturation'>
>

/** 重算间隔 */
const RECONVERT_INTERVAL_MS = 120

type ConversionStore = {
  params: ConvertParams
  /** 豆规格只换算成品尺寸，不进转换参数：换规格不该重算图纸 */
  beadSizeId: BeadSizeId
  /** 比例锁定：改一边，另一边按原图宽高比跟着变 */
  aspectLocked: boolean
  /** 当前选中的板数预设；手动改过颗数后清空 */
  activePresetId: string | null
  source: SourceInfo | null
  pattern: Pattern | null
  status: ConvertStatus
  /** 给用户看的一句话：被拒绝的原因、读图失败的原因 */
  notice: string | null
  loadFile: (file: File) => Promise<void>
  applyPreset: (presetId: string) => void
  setGridSize: (side: 'cols' | 'rows', value: number) => void
  setAspectLocked: (locked: boolean) => void
  setBeadSize: (beadSizeId: BeadSizeId) => void
  updateParams: (patch: TunableParams) => void
  /** 把这个色号标成不摆豆；换图后不清空，空白色号是跨图通用的判断 */
  markBlank: (code: BeadCode) => void
  unmarkBlank: (code: BeadCode) => void
}

const convertClient = createConvertClient()

/**
 * 换图可能重叠：前一张图的解码还没回来，用户已经选了下一张。
 * 只有最后一次加载的结果算数，否则慢的那张会把新图盖掉。
 */
let loadSequence = 0

/** 装图方式由比例锁定决定：锁着走铺满，解锁走居中裁切 */
function fitFor(aspectLocked: boolean): ConvertFit {
  return aspectLocked ? 'fill' : 'crop'
}

function clampSide(value: number): number {
  if (!Number.isFinite(value)) {
    return 1
  }
  return Math.max(1, Math.round(value))
}

export const useConversion = create<ConversionStore>((set, get) => {
  const reconvert = createThrottledRunner(() => {
    void convertCurrent()
  }, RECONVERT_INTERVAL_MS)

  /** 重开比例锁定时以哪一边为准：用户最后改过的那一边 */
  let lastEditedSide: 'cols' | 'rows' = 'cols'

  /** 改参数只有一条路：换上新的参数对象，再请一次重算 */
  function commitParams(next: ConvertParams): void {
    set({ params: next })
    reconvert.request()
  }

  /** 用当前参数转一次；换图与改参数都走这里，保证只有一条转换路径 */
  async function convertCurrent(): Promise<void> {
    const { params, source } = get()
    if (!source) {
      return
    }
    set({ status: 'converting', notice: null })

    const result = await convertClient.convert(params)
    if (result.status === 'superseded') {
      return
    }
    if (result.status === 'converted') {
      set({ status: 'ready', pattern: result.pattern, notice: null })
      return
    }
    if (result.status === 'rejected') {
      set({
        status: 'rejected',
        pattern: null,
        notice: describeRejection(result, beadSizeById(get().beadSizeId)),
      })
      return
    }
    set({ status: 'failed', pattern: null, notice: result.message })
  }

  return {
    params: defaultConvertParams(),
    beadSizeId: 'standard',
    aspectLocked: true,
    activePresetId: null,
    source: null,
    pattern: null,
    status: 'idle',
    notice: null,

    async loadFile(file) {
      loadSequence += 1
      const sequence = loadSequence
      reconvert.cancel()
      lastEditedSide = 'cols'
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
      const sourceInfo: SourceInfo = {
        fileName: loaded.source.fileName,
        width: loaded.source.width,
        height: loaded.source.height,
      }

      // 拿到源图尺寸后按比例补出行数
      const { params, aspectLocked } = get()
      const nextParams = aspectLocked
        ? { ...params, rows: rowsForCols(params.cols, sourceInfo), fit: fitFor(true) }
        : params

      set({ source: sourceInfo, params: nextParams })
      await convertCurrent()
    },

    applyPreset(presetId) {
      const preset = GRID_PRESETS.find((candidate) => candidate.id === presetId)
      if (!preset) {
        return
      }
      // 预设等于「用满 N 块板」：网格取该板数拼出来的形状，比例锁定让位，改为居中裁切
      set({
        params: { ...get().params, cols: preset.cols, rows: preset.rows, fit: fitFor(false) },
        aspectLocked: false,
        activePresetId: preset.id,
      })
      reconvert.request()
    },

    setGridSize(side, value) {
      const { params, aspectLocked, source } = get()
      const clamped = clampSide(value)
      let { cols, rows } = params

      lastEditedSide = side
      if (side === 'cols') {
        cols = clamped
        rows = aspectLocked && source ? rowsForCols(clamped, source) : rows
      } else {
        rows = clamped
        cols = aspectLocked && source ? colsForRows(clamped, source) : cols
      }

      set({
        params: { ...params, cols, rows, fit: fitFor(aspectLocked) },
        activePresetId: null,
      })
      reconvert.request()
    },

    setAspectLocked(locked) {
      const { params, source } = get()
      if (locked && source) {
        // 以最后改过的那一边为准推另一边，用户刚输入的值不被改写
        const cols = lastEditedSide === 'rows' ? colsForRows(params.rows, source) : params.cols
        const rows = lastEditedSide === 'rows' ? params.rows : rowsForCols(params.cols, source)
        set({
          params: { ...params, cols, rows, fit: fitFor(true) },
          aspectLocked: true,
          activePresetId: null,
        })
        reconvert.request()
        return
      }
      // 没有源图时推不出另一边，只记下状态
      set({ params: { ...params, fit: fitFor(locked) }, aspectLocked: locked })
      if (!locked) {
        reconvert.request()
      }
    },

    setBeadSize(beadSizeId) {
      // 换豆规格只换成品的物理尺寸，网格数据通用，不重算
      set({ beadSizeId })
    },

    updateParams(patch) {
      commitParams({ ...get().params, ...patch })
    },

    markBlank(code) {
      const { params } = get()
      if (params.blankCodes.includes(code)) {
        return
      }
      commitParams({ ...params, blankCodes: [...params.blankCodes, code] })
    },

    unmarkBlank(code) {
      const { params } = get()
      if (!params.blankCodes.includes(code)) {
        return
      }
      commitParams({
        ...params,
        blankCodes: params.blankCodes.filter((item) => item !== code),
      })
    },
  }
})
