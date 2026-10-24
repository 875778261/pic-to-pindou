/**
 * 读本地图片文件，得到可以直接送进转换的像素。
 *
 * 图片不离开设备：解码、缩放、取像素全在浏览器里完成。
 */

import type { PixelSource } from '../domain/source'

export const MAX_FILE_BYTES = 20 * 1024 * 1024

export const ACCEPTED_MIME_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp']

/**
 * 解码上限。网格最大 200 × 200，再多像素对结果没有贡献，只会在主线程解出几百 MB 的数组，
 * 所以先缩到 2048 × 2048 量级（约 400 万像素）以内。
 */
const MAX_DECODE_PIXELS = 4_194_304

export type LoadedSource = PixelSource & { fileName: string }

export type ImageLoadFailureReason = 'unsupported-type' | 'too-large' | 'decode-failed'

export type ImageLoadResult =
  | { status: 'loaded'; source: LoadedSource }
  | { status: 'failed'; reason: ImageLoadFailureReason; message: string }

export function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function looksLikeSupportedType(file: File): boolean {
  if (ACCEPTED_MIME_TYPES.includes(file.type)) {
    return true
  }
  // 部分来源（比如从别的页面拖出来的图）不给 MIME，退回看扩展名
  return /\.(jpe?g|png|webp)$/i.test(file.name)
}

/**
 * createImageBitmap 能明确按 EXIF 方向摆正，竖拍照片不会横躺。
 * 老浏览器不认这个选项时退回 <img>，并把 image-orientation 显式设成 from-image。
 */
async function decodeImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      // 落到 <img> 分支
    }
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    image.style.imageOrientation = 'from-image'
    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('图片解码失败'))
    }
    image.src = objectUrl
  })
}

export async function loadImageFile(file: File): Promise<ImageLoadResult> {
  if (!looksLikeSupportedType(file)) {
    return {
      status: 'failed',
      reason: 'unsupported-type',
      message: '只支持 JPEG、PNG、WebP 三种格式，请换一张图。',
    }
  }

  if (file.size > MAX_FILE_BYTES) {
    return {
      status: 'failed',
      reason: 'too-large',
      message: `这张图 ${formatMegabytes(file.size)}，超过 ${formatMegabytes(MAX_FILE_BYTES)} 上限，请先压缩或裁剪。`,
    }
  }

  let decoded: ImageBitmap | HTMLImageElement
  try {
    decoded = await decodeImage(file)
  } catch {
    return { status: 'failed', reason: 'decode-failed', message: '这张图读不出来，可能已损坏。' }
  }

  try {
    const scale = Math.min(1, Math.sqrt(MAX_DECODE_PIXELS / (decoded.width * decoded.height)))
    const width = Math.max(1, Math.round(decoded.width * scale))
    const height = Math.max(1, Math.round(decoded.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) {
      throw new Error('浏览器不支持 2D 画布')
    }
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(decoded, 0, 0, width, height)

    const imageData = context.getImageData(0, 0, width, height)
    return {
      status: 'loaded',
      source: { fileName: file.name, width, height, pixels: imageData.data },
    }
  } catch {
    return { status: 'failed', reason: 'decode-failed', message: '这张图读不出来，可能已损坏。' }
  } finally {
    if (decoded instanceof ImageBitmap) {
      decoded.close()
    }
  }
}
