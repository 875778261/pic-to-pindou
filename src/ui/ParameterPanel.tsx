/**
 * 参数面板：尺寸、豆规格、色号上限、空白色号、明暗、抖动。
 *
 * 尺寸有两条路——板数预设（用满 N 块板，取该板数拼出来的网格 + 居中裁切）与自由输入
 * （锁比例时不裁切，见 ADR-0007）。面板对当前走的是哪条路给出明示，用户不用猜画面有没有被剪。
 */

import { BEAD_SIZES } from '../domain/bead-size'
import { cropShare } from '../domain/crop'
import { GRID_PRESETS } from '../domain/grid-size'
import { useConversion } from '../state/store'
import { BlankCodes } from './BlankCodes'
import { ChoiceGroup } from './ChoiceGroup'
import { ColourAdjustments } from './ColourAdjustments'
import { NumberField } from './NumberField'
import { RangeField } from './RangeField'
import { ratioLabel } from './ratio'

function SectionTitle({ children }: { children: string }) {
  return <h2 className="font-medium text-neutral-900 text-sm">{children}</h2>
}

const BEAD_SIZE_OPTIONS = BEAD_SIZES.map((size) => ({
  id: size.id,
  label: size.label,
  hint: `${size.diameterMm} mm`,
}))

const PRESET_OPTIONS = GRID_PRESETS.map((preset) => ({
  id: preset.id,
  label: preset.label,
  hint: `${preset.cols}×${preset.rows}`,
}))

export function ParameterPanel() {
  const params = useConversion((state) => state.params)
  const source = useConversion((state) => state.source)
  const pattern = useConversion((state) => state.pattern)
  const beadSizeId = useConversion((state) => state.beadSizeId)
  const aspectLocked = useConversion((state) => state.aspectLocked)
  const activePresetId = useConversion((state) => state.activePresetId)
  const applyPreset = useConversion((state) => state.applyPreset)
  const setGridSize = useConversion((state) => state.setGridSize)
  const setAspectLocked = useConversion((state) => state.setAspectLocked)
  const setBeadSize = useConversion((state) => state.setBeadSize)
  const updateParams = useConversion((state) => state.updateParams)

  const croppedPercent =
    source && params.fit === 'crop'
      ? Math.round(cropShare(params.cols, params.rows, source) * 100)
      : 0
  const gridRatio = ratioLabel(params.cols, params.rows)

  const sizeHint = () => {
    if (!source) {
      return '上传图片后，这里会说明画面是被保留还是被裁掉'
    }
    const sourceRatio = ratioLabel(source.width, source.height)
    if (aspectLocked) {
      return `按原图 ${sourceRatio} 出网格，画面完整保留`
    }
    if (croppedPercent > 0) {
      return `未锁比例：从 ${sourceRatio} 裁成 ${gridRatio}，约裁掉 ${croppedPercent}% 的画面`
    }
    return `未锁比例，但网格 ${gridRatio} 与原图一致，不会裁掉画面`
  }

  return (
    <section
      aria-label="转换参数"
      className="flex flex-col gap-5 rounded-xl border border-neutral-200 bg-white p-4"
    >
      <div>
        <SectionTitle>尺寸</SectionTitle>

        <div className="mt-2">
          <ChoiceGroup
            options={PRESET_OPTIONS}
            selectedId={activePresetId}
            columns={4}
            onSelect={applyPreset}
          />
        </div>

        <div className="mt-2 flex items-end gap-2">
          <NumberField
            label="宽（颗）"
            value={params.cols}
            onChange={(value) => setGridSize('cols', value)}
          />
          <span className="pb-1.5 text-neutral-400 text-xs">×</span>
          <NumberField
            label="高（颗）"
            value={params.rows}
            onChange={(value) => setGridSize('rows', value)}
          />
        </div>

        <label className="mt-2 flex items-center gap-2 text-neutral-700 text-xs">
          <input
            type="checkbox"
            checked={aspectLocked}
            className="accent-neutral-900"
            onChange={(event) => setAspectLocked(event.target.checked)}
          />
          锁定原图宽高比
        </label>

        <p className={`mt-1 text-xs ${croppedPercent > 0 ? 'text-amber-700' : 'text-neutral-500'}`}>
          {sizeHint()}
        </p>
      </div>

      <div>
        <SectionTitle>豆规格</SectionTitle>
        <div className="mt-2">
          <ChoiceGroup
            options={BEAD_SIZE_OPTIONS}
            selectedId={beadSizeId}
            columns={3}
            onSelect={setBeadSize}
          />
        </div>
      </div>

      <div>
        <SectionTitle>色号</SectionTitle>
        <div className="mt-2">
          <RangeField
            label="最多用几个色号"
            value={params.maxColours}
            min={8}
            max={40}
            neutralValue={16}
            display={`上限 ${params.maxColours} · 实际用了 ${pattern?.usedCodes.length ?? 0}`}
            onChange={(maxColours) => updateParams({ maxColours })}
          />
        </div>
      </div>

      <div>
        <SectionTitle>空白色号</SectionTitle>
        <div className="mt-2">
          <BlankCodes />
        </div>
      </div>

      <div>
        <SectionTitle>明暗与色彩</SectionTitle>
        <div className="mt-2">
          <ColourAdjustments />
        </div>
      </div>

      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={params.dither}
          className="mt-0.5 accent-neutral-900"
          onChange={(event) => updateParams({ dither: event.target.checked })}
        />
        <span>
          <span className="block font-medium text-neutral-800 text-xs">抖动</span>
          <span className="block text-neutral-500 text-xs">
            打开后边缘会撒零散色点，可能要为一格单独开一包豆。
          </span>
        </span>
      </label>
    </section>
  )
}
