/**
 * 把合成好的图纸交给用户。
 *
 * 只做「画布 → PNG 文件 → 浏览器下载」这一段，不掺排版也不掺画法。
 */

import { drawPatternSheet, type PatternSheetInput } from './drawPattern'

export type ExportResult = {
  fileName: string
  width: number
  height: number
}

/** 文件名里去掉路径分隔符与系统不收的字符，其余照原样保留（中文名照样能用） */
function sanitiseFileNameBase(base: string): string {
  const withoutExtension = base.replace(/\.[^.]+$/, '')
  const cleaned = withoutExtension.replace(/[\\/:*?"<>|]/g, '').trim()
  return cleaned || '拼豆图纸'
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
      } else {
        reject(new Error('PNG 编码失败，可能是图纸太大'))
      }
    }, 'image/png')
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
  const canvas = drawPatternSheet(input)
  const blob = await canvasToBlob(canvas)
  const { cols, rows } = input.pattern.grid
  // 同一张网格在三种豆规格下是三个不同成品，规格要进文件名
  const fileName = `${sanitiseFileNameBase(fileNameBase)}-${cols}x${rows}-${input.beadSize.diameterMm}mm.png`
  triggerDownload(blob, fileName)
  return { fileName, width: canvas.width, height: canvas.height }
}
