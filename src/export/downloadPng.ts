/**
 * 把合成好的图纸交给用户。
 *
 * 只做「画布 → PNG 文件 → 浏览器下载」这一段，不掺排版也不掺画法。
 * 24 像素/颗画不出来时退到安全预算重排一次，降了就如实报出去（ADR-0017）。
 */

import { drawPatternSheet, type PatternSheetInput } from './drawPattern'
import { SAFE_LIMITS } from './layout'

export type ExportResult = {
  fileName: string
  width: number
  height: number
  /** 这张图纸有没有在格内标色号，用来如实回报给用户 */
  labelled: boolean
  /** 一颗豆实际占的像素。被上限压过时小于 24 */
  cellSize: number
}

/** 文件名里去掉路径分隔符与系统不收的字符，其余照原样保留（中文名照样能用） */
function sanitiseFileNameBase(base: string): string {
  const withoutExtension = base.replace(/\.[^.]+$/, '')
  const cleaned = withoutExtension.replace(/[\\/:*?"<>|]/g, '').trim()
  return cleaned || '拼豆图纸'
}

/** 编码不出图时给 null，让调用方决定要不要换预算重来 */
function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png')
  })
}

function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  // 同步 revoke 会让部分浏览器下载到空文件，留一段时间再收
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function exportPatternSheet(
  input: PatternSheetInput,
  fileNameBase: string,
): Promise<ExportResult> {
  let sheet = drawPatternSheet(input)
  let blob = await canvasToBlob(sheet.canvas)

  if (!blob) {
    // 这台设备画不出声明上限内的尺寸，退到安全预算重排一次
    sheet = drawPatternSheet(input, SAFE_LIMITS)
    blob = await canvasToBlob(sheet.canvas)
  }
  if (!blob) {
    throw new Error('24 像素与降级后的格宽都没能编码成功，把网格改小一些再导出')
  }

  const { cols, rows } = input.pattern.grid
  // 同一张网格在三种豆规格下是三个不同成品，规格要进文件名
  const fileName = `${sanitiseFileNameBase(fileNameBase)}-${cols}x${rows}-${input.beadSize.diameterMm}mm.png`
  triggerDownload(blob, fileName)
  return {
    fileName,
    width: sheet.canvas.width,
    height: sheet.canvas.height,
    labelled: sheet.layout.labelled,
    cellSize: sheet.layout.cellSize,
  }
}
