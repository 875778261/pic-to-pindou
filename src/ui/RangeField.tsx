/**
 * 一条带数值与复位按钮的滑块。
 *
 * 三项调色与色号上限共用它：都是「拖到某个值、随时能回到中性」的形状。
 */

type RangeFieldProps = {
  label: string
  value: number
  min: number
  max: number
  step?: number
  /** 右侧显示的文字，由调用方决定百分点还是颗数 */
  display: string
  /** 复位的目标值 */
  neutralValue: number
  onChange: (value: number) => void
}

export function RangeField({
  label,
  value,
  min,
  max,
  step = 1,
  display,
  neutralValue,
  onChange,
}: RangeFieldProps) {
  const atNeutral = value === neutralValue

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-neutral-600 text-xs">{label}</span>
        <span className="font-medium text-neutral-900 text-xs tabular-nums">{display}</span>
      </div>

      <div className="mt-1 flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label={label}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 accent-neutral-900"
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <button
          type="button"
          disabled={atNeutral}
          className="shrink-0 rounded px-1.5 py-0.5 text-neutral-500 text-xs hover:bg-neutral-100 disabled:opacity-40"
          onClick={() => onChange(neutralValue)}
        >
          复位
        </button>
      </div>
    </div>
  )
}
