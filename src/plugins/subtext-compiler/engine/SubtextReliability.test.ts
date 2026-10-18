import { describe, it, expect } from 'vitest'
import { SubtextCompilerEngine as engine } from './SubtextCompilerEngine'
describe('author subtext draft', () => {
  it('does not infer hidden fear or diagnostic mechanisms from pride', () => {
    const report = engine.compile('我做到了。', '甲', 'pride')
    expect(report.subtext).toBe('')
    expect(report.beatAction).toBe('')
    expect(report).not.toHaveProperty('defenseMechanism')
    expect(report).not.toHaveProperty('tensionLevel')
  })
  it('uses explicit goal and intended meaning without adding setting facts', () => {
    const report = engine.compile('明天见。', '甲', 'fear', {
      goal: '结束谈话',
      intendedMeaning: '暂时不要再问。',
      action: '她把信收好。',
    })
    expect(report).toMatchObject({
      spoken: '明天见。',
      goal: '结束谈话',
      subtext: '暂时不要再问。',
      beatAction: '她把信收好。',
    })
    expect(engine.renderNovelParagraph(report)).toBe('她把信收好。\n甲说：“明天见。”')
  })
  it('refuses missing speaker or dialogue instead of building a fake paragraph', () => {
    expect(() => engine.compile('', '甲', 'anger')).toThrow()
    expect(() => engine.compile('明白。', '', 'fear')).toThrow()
  })
})
