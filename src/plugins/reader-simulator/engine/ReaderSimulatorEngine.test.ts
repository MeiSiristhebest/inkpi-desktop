import { describe, it, expect } from 'vitest'
import { ReaderSimulatorEngine } from './ReaderSimulatorEngine'

describe('ReaderSimulatorEngine', () => {
  it('detects high toxicity score and toxic alerts on humiliation plots', () => {
    const text = '反派冷笑逼迫主角跪下磕头，自扇耳光，主角竟不忍加害放他离去。'
    const res = ReaderSimulatorEngine.simulateChapter({
      chapterId: 'c1',
      chapterTitle: '屈辱',
      chapterOrder: 1,
      content: text,
    })

    expect(res.toxicityScore).toBeGreaterThanOrEqual(40)
    expect(res.toxicAlerts.length).toBeGreaterThan(0)
    expect(res.comments.some((c) => c.sentiment === 'toxic_alert')).toBe(true)
  })

  it('detects high pleasure score and praise comments on epic kills', () => {
    const text = '陆沉一剑破万法，杀伐果断，直接让高高在上的神王陨落，全场死寂！'
    const res = ReaderSimulatorEngine.simulateChapter({
      chapterId: 'c2',
      chapterTitle: '封神',
      chapterOrder: 2,
      content: text,
    })

    expect(res.pleasureScore).toBeGreaterThanOrEqual(60)
    expect(res.comments.some((c) => c.sentiment === 'praise')).toBe(true)
  })
})
