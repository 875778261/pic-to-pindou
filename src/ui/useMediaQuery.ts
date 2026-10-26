/**
 * 一条媒体查询的当前结果，窗口变化时跟着更新。
 *
 * 断点只在用 Tailwind 的 `lg:` 那一处定义，JS 这边要跟它保持一致。
 */

import { useEffect, useState } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const list = window.matchMedia(query)
    const update = () => setMatches(list.matches)
    update()
    list.addEventListener('change', update)
    return () => list.removeEventListener('change', update)
  }, [query])

  return matches
}

/** 三栏布局的起点，与 `lg:` 一致 */
export const WIDE_QUERY = '(min-width: 1024px)'
