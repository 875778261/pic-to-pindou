/**
 * 色彩空间与色差。
 *
 * 色差用 CIEDE2000：sRGB 欧氏距离在暗部与肤色区会配错，而人物与宠物照片是主要题材。
 */

export type Rgb = { r: number; g: number; b: number }
export type Lab = { l: number; a: number; b: number }

/** D65 参考白，与 sRGB 标准光源一致 */
const WHITE_X = 0.95047
const WHITE_Y = 1
const WHITE_Z = 1.08883

/** CIEDE2000 里的 25^7，用于色度权重的软化项 */
const POW_25_7 = 25 ** 7

/** sRGB 传递函数的线性化阈值 */
const LINEAR_THRESHOLD = 0.04045

export function hexToRgb(hex: string): Rgb {
  const normalized = hex.trim().replace(/^#/, '')
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    throw new Error(`屏幕色格式非法，需要 6 位十六进制：${hex}`)
  }
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  }
}

/** 取整并夹到 0–255：所有通道运算的出口都用它，避免各写一份 */
export function clampToByte(value: number): number {
  return Math.round(Math.min(255, Math.max(0, value)))
}

export function rgbToHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b]
    .map((value) => clampToByte(value).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`
}

/** 三个通道压成一个整数，用作按颜色查表的键 */
export function packRgb({ r, g, b }: Rgb): number {
  return (r << 16) | (g << 8) | b
}

export function unpackRgb(packed: number): Rgb {
  return { r: (packed >> 16) & 0xff, g: (packed >> 8) & 0xff, b: packed & 0xff }
}

function toLinear(channel: number): number {
  const scaled = channel / 255
  return scaled <= LINEAR_THRESHOLD ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4
}

export function rgbToLab(rgb: Rgb): Lab {
  const r = toLinear(rgb.r)
  const g = toLinear(rgb.g)
  const b = toLinear(rgb.b)

  const x = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b
  const z = 0.0193339 * r + 0.119192 * g + 0.9503041 * b

  // CIE 标准里的立方根分段：小值区改用线性段，避免在暗部放大噪声
  const epsilon = (6 / 29) ** 3
  const f = (t: number) => (t > epsilon ? Math.cbrt(t) : t / (3 * (6 / 29) ** 2) + 4 / 29)

  const fx = f(x / WHITE_X)
  const fy = f(y / WHITE_Y)
  const fz = f(z / WHITE_Z)

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  }
}

export function hexToLab(hex: string): Lab {
  return rgbToLab(hexToRgb(hex))
}

/** 色相角，返回 [0, 360) 度 */
function hueAngle(a: number, b: number): number {
  if (a === 0 && b === 0) {
    return 0
  }
  const degrees = (Math.atan2(b, a) * 180) / Math.PI
  return degrees >= 0 ? degrees : degrees + 360
}

/** 色相差，折算到 (-180, 180] 度，取最短方向 */
function hueDelta(h1: number, h2: number): number {
  const raw = h2 - h1
  if (raw > 180) {
    return raw - 360
  }
  if (raw < -180) {
    return raw + 360
  }
  return raw
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180

export function deltaE2000(x: Lab, y: Lab): number {
  const c1 = Math.hypot(x.a, x.b)
  const c2 = Math.hypot(y.a, y.b)
  const cMean = (c1 + c2) / 2

  // G 项把接近中性的低彩度区拉平，避免灰阶被过度计分
  const g = 0.5 * (1 - Math.sqrt(cMean ** 7 / (cMean ** 7 + POW_25_7)))
  const a1Prime = (1 + g) * x.a
  const a2Prime = (1 + g) * y.a

  const c1Prime = Math.hypot(a1Prime, x.b)
  const c2Prime = Math.hypot(a2Prime, y.b)
  const h1Prime = hueAngle(a1Prime, x.b)
  const h2Prime = hueAngle(a2Prime, y.b)

  const deltaL = y.l - x.l
  const deltaC = c2Prime - c1Prime

  const chromaIsFlat = c1Prime * c2Prime === 0
  const deltaBigH = chromaIsFlat ? 0 : hueDelta(h1Prime, h2Prime)
  const deltaH = 2 * Math.sqrt(c1Prime * c2Prime) * Math.sin(toRadians(deltaBigH / 2))

  const meanL = (x.l + y.l) / 2
  const meanC = (c1Prime + c2Prime) / 2
  const meanH = chromaIsFlat
    ? h1Prime + h2Prime
    : Math.abs(h1Prime - h2Prime) <= 180
      ? (h1Prime + h2Prime) / 2
      : h1Prime + h2Prime < 360
        ? (h1Prime + h2Prime + 360) / 2
        : (h1Prime + h2Prime - 360) / 2

  const t =
    1 -
    0.17 * Math.cos(toRadians(meanH - 30)) +
    0.24 * Math.cos(toRadians(2 * meanH)) +
    0.32 * Math.cos(toRadians(3 * meanH + 6)) -
    0.2 * Math.cos(toRadians(4 * meanH - 63))

  const rotation = 30 * Math.exp(-(((meanH - 275) / 25) ** 2))
  const rc = 2 * Math.sqrt(meanC ** 7 / (meanC ** 7 + POW_25_7))

  const lightnessTerm = 1 + (0.015 * (meanL - 50) ** 2) / Math.sqrt(20 + (meanL - 50) ** 2)
  const chromaTerm = 1 + 0.045 * meanC
  const hueTerm = 1 + 0.015 * meanC * t
  const rt = -Math.sin(toRadians(2 * rotation)) * rc

  return Math.sqrt(
    (deltaL / lightnessTerm) ** 2 +
      (deltaC / chromaTerm) ** 2 +
      (deltaH / hueTerm) ** 2 +
      rt * (deltaC / chromaTerm) * (deltaH / hueTerm),
  )
}
