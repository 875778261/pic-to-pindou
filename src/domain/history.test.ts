import { describe, expect, it } from 'vitest'
import {
  HISTORY_LIMIT,
  recordStep,
  redoStep,
  replacePresent,
  startHistory,
  undoStep,
} from './history'

describe('撤销栈', () => {
  it('刚起手的栈没有可撤销也没有可重做', () => {
    const history = startHistory('a')
    expect(history.present).toBe('a')
    expect(history.past).toEqual([])
    expect(history.future).toEqual([])
    expect(undoStep(history)).toBe(history)
    expect(redoStep(history)).toBe(history)
  })

  it('记一步之后能撤销回上一张，再重做回来', () => {
    const history = recordStep(startHistory('a'), 'b')
    const undone = undoStep(history)
    expect(undone.present).toBe('a')
    expect(redoStep(undone).present).toBe('b')
  })

  it('连着撤销再连着重做，回到原处', () => {
    let history = startHistory('a')
    history = recordStep(history, 'b')
    history = recordStep(history, 'c')

    const twiceUndone = undoStep(undoStep(history))
    expect(twiceUndone.present).toBe('a')

    expect(redoStep(redoStep(twiceUndone)).present).toBe('c')
  })

  it('撤销到底后再撤销没有副作用', () => {
    const history = undoStep(recordStep(startHistory('a'), 'b'))
    expect(undoStep(history)).toBe(history)
  })

  it('重做到底后再重做没有副作用', () => {
    const history = recordStep(startHistory('a'), 'b')
    expect(redoStep(history)).toBe(history)
  })

  it('撤销之后又改动，重做分支作废', () => {
    const history = recordStep(startHistory('a'), 'b')
    const undone = undoStep(history)
    const rebranched = recordStep(undone, 'c')

    expect(rebranched.present).toBe('c')
    expect(rebranched.future).toEqual([])
    expect(undoStep(rebranched).present).toBe('a')
  })

  it('深度到上限后丢最老的一步，不崩', () => {
    let history = startHistory(0)
    for (let step = 1; step <= HISTORY_LIMIT + 5; step += 1) {
      history = recordStep(history, step)
    }

    expect(history.past).toHaveLength(HISTORY_LIMIT)
    // 记到第 55 张时栈里留住的是第 5…54 张，撤销 50 次只能退到第 5 张
    let undone = history
    for (let step = 0; step < HISTORY_LIMIT; step += 1) {
      undone = undoStep(undone)
    }
    expect(undone.present).toBe(5)
    expect(undoStep(undone)).toBe(undone)
  })

  it('上限可调，卡到上限的语义一样', () => {
    let history = startHistory(0)
    for (let step = 1; step <= 4; step += 1) {
      history = recordStep(history, step, 2)
    }

    expect(history.past).toEqual([2, 3])
    expect(undoStep(undoStep(history)).present).toBe(2)
  })

  it('记一步不动传进去的栈', () => {
    const history = startHistory('a')
    recordStep(history, 'b')
    expect(history.present).toBe('a')
    expect(history.past).toEqual([])
  })
})

describe('顶替当前一张', () => {
  it('换掉当前而不记一步，历史原样留着', () => {
    let history = startHistory('a')
    history = recordStep(history, 'b')
    history = replacePresent(history, 'b2')

    expect(history.present).toBe('b2')
    expect(history.past).toEqual(['a'])
    // 撤一步还是回到 a，b 没有额外占一格
    expect(undoStep(history).present).toBe('a')
  })

  it('顶替会让重做分支作废', () => {
    let history = recordStep(startHistory('a'), 'b')
    history = undoStep(history)
    expect(history.future).toEqual(['b'])

    expect(replacePresent(history, 'c').future).toEqual([])
  })

  it('连着顶替很多次，栈深度不涨', () => {
    let history = recordStep(startHistory('a'), 'b')
    for (let round = 0; round < 30; round += 1) {
      history = replacePresent(history, `b${round}`)
    }

    expect(history.past).toEqual(['a'])
  })
})
