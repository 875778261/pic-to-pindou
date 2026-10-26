/**
 * 一组互斥选项按钮：上面一行是叫法，下面一行是具体取值。
 *
 * 板数预设与豆规格是同一种形状，只是列数与选项不同。
 */

export type ChoiceOption<Id extends string> = {
  id: Id
  label: string
  hint: string
}

type ChoiceGroupProps<Id extends string> = {
  options: readonly ChoiceOption<Id>[]
  selectedId: Id | null
  columns: 3 | 4
  onSelect: (id: Id) => void
}

export function ChoiceGroup<Id extends string>({
  options,
  selectedId,
  columns,
  onSelect,
}: ChoiceGroupProps<Id>) {
  const layout = columns === 4 ? 'grid-cols-4' : 'grid-cols-3'

  return (
    <div className={`grid gap-1 ${layout}`}>
      {options.map((option) => {
        const active = option.id === selectedId
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            className={`rounded-md border px-1 py-1.5 text-center text-xs ${
              active
                ? 'border-neutral-900 bg-neutral-900 text-white'
                : 'border-neutral-200 text-neutral-700 hover:border-neutral-400'
            }`}
            onClick={() => onSelect(option.id)}
          >
            <span className="block font-medium">{option.label}</span>
            <span
              className={`block text-[10px] tabular-nums ${
                active ? 'opacity-80' : 'text-neutral-400'
              }`}
            >
              {option.hint}
            </span>
          </button>
        )
      })}
    </div>
  )
}
