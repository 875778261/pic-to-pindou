/**
 * 亮度、对比度、饱和度。
 *
 * 三项都作用在采样之后、量化之前，与预览里看到的颜色一致（domain/adjust.ts）。
 */

import { useConversion } from '../state/store'
import { RangeField } from './RangeField'

export function ColourAdjustments() {
  const params = useConversion((state) => state.params)
  const updateParams = useConversion((state) => state.updateParams)

  return (
    <div className="flex flex-col gap-3">
      <RangeField
        label="亮度"
        value={params.brightness}
        min={-100}
        max={100}
        neutralValue={0}
        display={`${params.brightness > 0 ? '+' : ''}${params.brightness}`}
        onChange={(brightness) => updateParams({ brightness })}
      />
      <RangeField
        label="对比度"
        value={params.contrast}
        min={0}
        max={2}
        step={0.01}
        neutralValue={1}
        display={`${Math.round(params.contrast * 100)}%`}
        onChange={(contrast) => updateParams({ contrast })}
      />
      <RangeField
        label="饱和度"
        value={params.saturation}
        min={0}
        max={2}
        step={0.01}
        neutralValue={1}
        display={`${Math.round(params.saturation * 100)}%`}
        onChange={(saturation) => updateParams({ saturation })}
      />
    </div>
  )
}
