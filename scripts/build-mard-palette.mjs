/**
 * 由 MARD 色卡数据快照生成 `src/domain/palette/mard.ts`。
 *
 * 快照来自 HansBug/pindou-color-data（见 docs/reference/source/ 下的对应文件与 README）。
 * 生成而不是手抄，是为了让「数据从哪来、怎么清洗」可复查。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourceDir = resolve(repoRoot, 'docs/reference/source')
const targetFile = resolve(repoRoot, 'src/domain/palette/mard.ts')

function readPalette(fileName) {
  const raw = JSON.parse(readFileSync(resolve(sourceDir, fileName), 'utf8'))
  const colours = raw.colors.map((colour) => ({
    code: colour.code,
    hex: colour.hex.toUpperCase(),
  }))
  return { id: raw.id, title: raw.title, colours }
}

const full = readPalette('mard-291-github.colors.json')
const standard = readPalette('mard-221-github.colors.json')

// 291 必须完整覆盖 221，且同色号同屏幕色
const fullByCode = new Map(full.colours.map((colour) => [colour.code, colour.hex]))
const mismatched = standard.colours.filter((colour) => fullByCode.get(colour.code) !== colour.hex)
if (mismatched.length > 0) {
  throw new Error(`221 与 291 在同色号上屏幕色不一致：${mismatched.map((c) => c.code).join(', ')}`)
}
const standardCodes = new Set(standard.colours.map((colour) => colour.code))
const missing = standard.colours.filter((colour) => !fullByCode.has(colour.code))
if (missing.length > 0) {
  throw new Error(`291 缺少 221 的色号：${missing.map((c) => c.code).join(', ')}`)
}

const lines = []
lines.push('/**')
lines.push(' * MARD 色卡。')
lines.push(' *')
lines.push(' * 本文件由 scripts/build-mard-palette.mjs 生成，不要手改。')
lines.push(' * 系列与材质由色号前缀推导，见 src/domain/palette/series.ts。')
lines.push(' */')
lines.push("import type { BeadCode, Palette, PaletteColour } from './types'")
lines.push("import { createPalette } from './types'")
lines.push('')
lines.push('/** 291 色全系 */')
lines.push('const MARD_291_COLOURS: readonly PaletteColour[] = [')
for (const colour of full.colours) {
  lines.push(`  { code: '${colour.code}', hex: '${colour.hex}' },`)
}
lines.push(']')
lines.push('')
lines.push('/** 221 色标准档的色号集合，屏幕色取自 291，保证两档同号同色 */')
lines.push('const MARD_221_CODES: readonly BeadCode[] = [')
for (const code of standardCodes) {
  lines.push(`  '${code}',`)
}
lines.push(']')
lines.push('')
lines.push('export const MARD_291: Palette = createPalette({')
lines.push(`  id: '${full.id}',`)
lines.push("  title: 'MARD 291 色（全系）',")
lines.push('  colours: MARD_291_COLOURS,')
lines.push('})')
lines.push('')
lines.push('const standardCodeSet = new Set<BeadCode>(MARD_221_CODES)')
lines.push('')
lines.push('export const MARD_221: Palette = createPalette({')
lines.push(`  id: '${standard.id}',`)
lines.push("  title: 'MARD 221 色（标准档）',")
lines.push('  colours: MARD_291_COLOURS.filter((colour) => standardCodeSet.has(colour.code)),')
lines.push('})')
lines.push('')

writeFileSync(targetFile, lines.join('\n'), 'utf8')
console.log(`已生成 ${targetFile}`)
console.log(`  291 色：${full.colours.length} 条`)
console.log(`  221 色：${standardCodes.size} 条（屏幕色沿用 291）`)
