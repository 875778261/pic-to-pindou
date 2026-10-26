/**
 * 量化：在色卡内部选色（ADR-0004）。
 *
 * 先把每个采样格认到最近的候选色号，得到候选色号的像素权重；再用 k-medoids（PAM）在候选集里
 * 挑出不超过 K 个色号；最后逐格映射到选中集合里最近的一个。
 * 候选集已排除特种色（ADR-0006），所以算法不会产出珠光、夜光色号。
 *
 * 全程确定性：同一张图在相同参数下必须给出完全一样的图纸，所以任何一步都不许用随机初始化，
 * 平局也必须有固定的裁决顺序。
 */

import {
  clampToByte,
  deltaE2000,
  hexToRgb,
  type Lab,
  packRgb,
  type Rgb,
  rgbToLab,
  unpackRgb,
} from './colour'
import type { BeadCode, Palette, PaletteEntry } from './palette/types'

type CandidateDistances = {
  entries: readonly PaletteEntry[]
  size: number
  /** size × size 的对称矩阵，行优先 */
  data: Float32Array
}

type AssignmentStats = {
  nearest: Int32Array
  nearestDistance: Float64Array
  secondDistance: Float64Array
}

/** 色差矩阵惰性构建后按档位缓存：它是纯函数结果，每次转换重算都是浪费 */
const distanceCache = new Map<string, CandidateDistances>()

function candidateDistances(palette: Palette): CandidateDistances {
  const cached = distanceCache.get(palette.id)
  if (cached) {
    return cached
  }

  const entries = palette.quantisationCandidates
  const size = entries.length
  const data = new Float32Array(size * size)
  for (let left = 0; left < size; left += 1) {
    const leftEntry = entries[left]
    if (!leftEntry) {
      continue
    }
    for (let right = left + 1; right < size; right += 1) {
      const rightEntry = entries[right]
      if (!rightEntry) {
        continue
      }
      const distance = deltaE2000(leftEntry.lab, rightEntry.lab)
      data[left * size + right] = distance
      data[right * size + left] = distance
    }
  }

  const matrix = { entries, size, data }
  distanceCache.set(palette.id, matrix)
  return matrix
}

function distanceAt(matrix: CandidateDistances, left: number, right: number): number {
  return matrix.data[left * matrix.size + right] ?? Number.POSITIVE_INFINITY
}

function nearestOf(entries: readonly PaletteEntry[], lab: Lab): PaletteEntry {
  let best = entries[0]
  if (!best) {
    throw new Error('量化候选集为空')
  }
  let bestDistance = deltaE2000(lab, best.lab)
  for (let index = 1; index < entries.length; index += 1) {
    const candidate = entries[index]
    if (!candidate) {
      continue
    }
    const distance = deltaE2000(lab, candidate.lab)
    if (distance < bestDistance) {
      bestDistance = distance
      best = candidate
    }
  }
  return best
}

/** 每个候选色号背后有多少个采样格「最像它」，就是 k-medoids 的权重 */
function candidateWeights(matrix: CandidateDistances, colours: readonly Rgb[]): Float64Array {
  const histogram = new Map<number, number>()
  for (const colour of colours) {
    const key = packRgb(colour)
    histogram.set(key, (histogram.get(key) ?? 0) + 1)
  }

  const positionByPaletteIndex = new Map<number, number>()
  matrix.entries.forEach((entry, position) => {
    positionByPaletteIndex.set(entry.index, position)
  })

  const weights = new Float64Array(matrix.size)
  for (const [packed, count] of histogram) {
    const nearest = nearestOf(matrix.entries, rgbToLab(unpackRgb(packed)))
    const position = positionByPaletteIndex.get(nearest.index)
    if (position !== undefined) {
      weights[position] = (weights[position] ?? 0) + count
    }
  }
  return weights
}

/** 当前这组 medoid 下，每个候选点到最近与第二近 medoid 的距离，供交换评估使用 */
function assignmentStats(matrix: CandidateDistances, medoids: readonly number[]): AssignmentStats {
  const nearest = new Int32Array(matrix.size).fill(-1)
  const nearestDistance = new Float64Array(matrix.size).fill(Number.POSITIVE_INFINITY)
  const secondDistance = new Float64Array(matrix.size).fill(Number.POSITIVE_INFINITY)

  for (let point = 0; point < matrix.size; point += 1) {
    for (const medoid of medoids) {
      const distance = distanceAt(matrix, point, medoid)
      if (distance < (nearestDistance[point] ?? Number.POSITIVE_INFINITY)) {
        secondDistance[point] = nearestDistance[point] ?? Number.POSITIVE_INFINITY
        nearestDistance[point] = distance
        nearest[point] = medoid
      } else if (distance < (secondDistance[point] ?? Number.POSITIVE_INFINITY)) {
        secondDistance[point] = distance
      }
    }
  }

  return { nearest, nearestDistance, secondDistance }
}

/** BUILD：每一步都挑当前总代价最小的那个候选，平局取更靠前的下标 */
function buildMedoids(
  matrix: CandidateDistances,
  weights: Float64Array,
  candidates: readonly number[],
  count: number,
): number[] {
  const medoids: number[] = []
  const nearestSoFar = new Float64Array(matrix.size).fill(Number.POSITIVE_INFINITY)

  for (let step = 0; step < count; step += 1) {
    let bestCandidate = -1
    let bestCost = Number.POSITIVE_INFINITY

    for (const candidate of candidates) {
      if (medoids.includes(candidate)) {
        continue
      }
      let cost = 0
      for (const point of candidates) {
        const distance = Math.min(
          nearestSoFar[point] ?? Number.POSITIVE_INFINITY,
          distanceAt(matrix, candidate, point),
        )
        cost += (weights[point] ?? 0) * distance
        if (cost >= bestCost) {
          break
        }
      }
      if (cost < bestCost) {
        bestCost = cost
        bestCandidate = candidate
      }
    }

    if (bestCandidate < 0) {
      break
    }
    medoids.push(bestCandidate)
    for (const point of candidates) {
      nearestSoFar[point] = Math.min(
        nearestSoFar[point] ?? Number.POSITIVE_INFINITY,
        distanceAt(matrix, bestCandidate, point),
      )
    }
  }

  return medoids
}

/** 把一个 medoid 换成某个候选之后总代价的变化量，负数才是改进 */
function swapDelta(
  matrix: CandidateDistances,
  weights: Float64Array,
  stats: AssignmentStats,
  candidates: readonly number[],
  outgoing: number,
  incoming: number,
): number {
  let delta = 0
  for (const point of candidates) {
    const before = stats.nearestDistance[point] ?? Number.POSITIVE_INFINITY
    const fallback =
      stats.nearest[point] === outgoing
        ? (stats.secondDistance[point] ?? Number.POSITIVE_INFINITY)
        : before
    const after = Math.min(fallback, distanceAt(matrix, point, incoming))
    delta += (weights[point] ?? 0) * (after - before)
  }
  return delta
}

const MAX_SWAP_ROUNDS = 8

const NO_EXCLUSIONS: ReadonlySet<BeadCode> = new Set()

/**
 * 选出不超过 maxColours 个色号，返回它们在量化候选集里的位置。
 * 实际可选色数少于上限时只选到实际色数为止，不会为了凑数塞进用不到的色号。
 * 被标成空白的色号不参与选色，也不占名额。
 */
export function selectMedoids(
  palette: Palette,
  colours: readonly Rgb[],
  maxColours: number,
  excludedCodes: ReadonlySet<BeadCode> = NO_EXCLUSIONS,
): number[] {
  if (!Number.isInteger(maxColours) || maxColours < 1) {
    throw new Error(`限色数必须是正整数：${maxColours}`)
  }

  const matrix = candidateDistances(palette)
  const weights = candidateWeights(matrix, colours)

  const candidates: number[] = []
  for (let position = 0; position < matrix.size; position += 1) {
    if ((weights[position] ?? 0) <= 0) {
      continue
    }
    const entry = matrix.entries[position]
    if (entry && excludedCodes.has(entry.code)) {
      continue
    }
    candidates.push(position)
  }

  const target = Math.min(maxColours, candidates.length)
  if (target === 0) {
    return []
  }

  const medoids = buildMedoids(matrix, weights, candidates, target)

  for (let round = 0; round < MAX_SWAP_ROUNDS; round += 1) {
    const stats = assignmentStats(matrix, medoids)
    let bestDelta = -1e-9
    let bestOutgoing = -1
    let bestIncoming = -1

    for (const outgoing of medoids) {
      for (const incoming of candidates) {
        if (medoids.includes(incoming)) {
          continue
        }
        const delta = swapDelta(matrix, weights, stats, candidates, outgoing, incoming)
        if (delta < bestDelta) {
          bestDelta = delta
          bestOutgoing = outgoing
          bestIncoming = incoming
        }
      }
    }

    if (bestOutgoing < 0) {
      break
    }
    medoids[medoids.indexOf(bestOutgoing)] = bestIncoming
  }

  return medoids
}

export function medoidEntries(
  palette: Palette,
  medoidPositions: readonly number[],
): PaletteEntry[] {
  const candidates = palette.quantisationCandidates
  const selected: PaletteEntry[] = []
  for (const position of medoidPositions) {
    const entry = candidates[position]
    if (entry) {
      selected.push(entry)
    }
  }
  return selected
}

/** 逐格映射到选中集合里最近的一个，返回各格颜色在色卡中的下标 */
export function mapColours(
  palette: Palette,
  medoidPositions: readonly number[],
  colours: readonly Rgb[],
): number[] {
  const selected = medoidEntries(palette, medoidPositions)
  if (selected.length === 0) {
    throw new Error('没有选中任何色号，无法映射')
  }

  const memo = new Map<number, number>()
  const indexes: number[] = new Array(colours.length)
  for (let cell = 0; cell < colours.length; cell += 1) {
    const colour = colours[cell]
    if (!colour) {
      continue
    }
    const key = packRgb(colour)
    let nearestIndex = memo.get(key)
    if (nearestIndex === undefined) {
      nearestIndex = nearestOf(selected, rgbToLab(colour)).index
      memo.set(key, nearestIndex)
    }
    indexes[cell] = nearestIndex
  }
  return indexes
}

type ColourError = { r: number; g: number; b: number }

/** Floyd–Steinberg 的四个扩散权重 */
const DITHER_RIGHT = 7 / 16
const DITHER_DOWN_LEFT = 3 / 16
const DITHER_DOWN = 5 / 16
const DITHER_DOWN_RIGHT = 1 / 16

function spreadError(
  carried: Float64Array,
  cols: number,
  rows: number,
  col: number,
  row: number,
  error: ColourError,
  factor: number,
  deltaCol: number,
  deltaRow: number,
): void {
  const targetCol = col + deltaCol
  const targetRow = row + deltaRow
  if (targetCol < 0 || targetCol >= cols || targetRow >= rows) {
    return
  }
  const offset = (targetRow * cols + targetCol) * 3
  carried[offset] = (carried[offset] ?? 0) + error.r * factor
  carried[offset + 1] = (carried[offset + 1] ?? 0) + error.g * factor
  carried[offset + 2] = (carried[offset + 2] ?? 0) + error.b * factor
}

/**
 * 误差扩散抖动（Floyd–Steinberg）。
 * 只作为可选后处理：抖动能更接近原图，但会产出零散色点，可能要为一格开一包豆。
 * blankMask 标出的格不产豆：既不往外扩散误差，也不接住邻居的误差。
 */
export function mapColoursWithDither(
  palette: Palette,
  medoidPositions: readonly number[],
  colours: readonly Rgb[],
  cols: number,
  rows: number,
  blankMask: Uint8Array | null = null,
): number[] {
  const selected = medoidEntries(palette, medoidPositions)
  if (selected.length === 0) {
    throw new Error('没有选中任何色号，无法映射')
  }

  const carried = new Float64Array(colours.length * 3)
  const indexes: number[] = new Array(colours.length)

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const cell = row * cols + col
      if (blankMask?.[cell]) {
        continue
      }
      const colour = colours[cell] ?? { r: 0, g: 0, b: 0 }
      const offset = cell * 3
      const working: Rgb = {
        r: colour.r + (carried[offset] ?? 0),
        g: colour.g + (carried[offset + 1] ?? 0),
        b: colour.b + (carried[offset + 2] ?? 0),
      }
      const clamped: Rgb = {
        r: clampToByte(working.r),
        g: clampToByte(working.g),
        b: clampToByte(working.b),
      }

      const chosen = nearestOf(selected, rgbToLab(clamped))
      indexes[cell] = chosen.index

      const chosenRgb = hexToRgb(chosen.hex)
      const error: ColourError = {
        r: working.r - chosenRgb.r,
        g: working.g - chosenRgb.g,
        b: working.b - chosenRgb.b,
      }

      spreadError(carried, cols, rows, col, row, error, DITHER_RIGHT, 1, 0)
      spreadError(carried, cols, rows, col, row, error, DITHER_DOWN_LEFT, -1, 1)
      spreadError(carried, cols, rows, col, row, error, DITHER_DOWN, 0, 1)
      spreadError(carried, cols, rows, col, row, error, DITHER_DOWN_RIGHT, 1, 1)
    }
  }

  return indexes
}
