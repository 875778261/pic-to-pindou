/**
 * 一张待转换的源图像素。
 *
 * 像素、宽、高三者永远一起流转（主线程解码 → Worker 采样），打包成一个类型免得到处传三个字段。
 */
export type PixelSource = {
  width: number
  height: number
  /** RGBA 逐像素排列，与 getImageData 的输出一致 */
  pixels: Uint8ClampedArray
}
