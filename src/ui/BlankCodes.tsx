/**
 * 空白色号：被标成不摆豆的色号，按标记顺序列出，逐个可撤销。
 *
 * 标记是在预览上点豆完成的，所以这里只负责「看得见标了哪些」与「怎么取消」。
 */

import { paletteById } from '../domain/palette/registry'
import { useConversion } from '../state/store'

export function BlankCodes() {
  const params = useConversion((state) => state.params)
  const unmarkBlank = useConversion((state) => state.unmarkBlank)
  const palette = paletteById(params.paletteId)

  if (params.blankCodes.length === 0) {
    return <p className="text-neutral-500 text-xs">在预览里点一颗豆，就能把它标成不摆豆。</p>
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-neutral-700 text-xs">已标 {params.blankCodes.length} 种，这些色号不摆豆</p>
      <ul className="flex flex-wrap gap-1">
        {params.blankCodes.map((code) => (
          <li key={code}>
            <button
              type="button"
              aria-label={`${code} 恢复摆豆`}
              className="flex items-center gap-1 rounded-md border border-neutral-200 px-1.5 py-1 text-neutral-700 text-xs hover:border-neutral-400"
              onClick={() => unmarkBlank(code)}
            >
              <span
                aria-hidden="true"
                className="block h-3 w-3 rounded-sm border border-neutral-300"
                style={{ backgroundColor: palette.byCode.get(code)?.hex ?? '#FFFFFF' }}
              />
              <span className="tabular-nums">{code}</span>
              <span aria-hidden="true" className="text-neutral-400">
                ×
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
