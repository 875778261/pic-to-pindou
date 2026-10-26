/**
 * 颗数输入。
 *
 * 输入过程留一份字符串草稿，这样能先清空再重输；只有能解析成数字时才提交。
 */

import { useEffect, useState } from 'react'

type NumberFieldProps = {
  label: string
  value: number
  onChange: (value: number) => void
}

export function NumberField({ label, value, onChange }: NumberFieldProps) {
  const [draft, setDraft] = useState(String(value))

  useEffect(() => {
    setDraft(String(value))
  }, [value])

  return (
    <label className="flex-1">
      <span className="text-neutral-600 text-xs">{label}</span>
      <input
        type="number"
        min={1}
        value={draft}
        className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1 text-neutral-900 text-sm tabular-nums focus:border-neutral-900 focus:outline-none"
        onChange={(event) => {
          const raw = event.target.value
          setDraft(raw)
          const parsed = Number(raw)
          if (raw !== '' && Number.isFinite(parsed)) {
            onChange(parsed)
          }
        }}
        onBlur={() => setDraft(String(value))}
      />
    </label>
  )
}
