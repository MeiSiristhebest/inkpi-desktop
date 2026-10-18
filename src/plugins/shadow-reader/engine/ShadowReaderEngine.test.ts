import { describe, it, expect } from 'vitest'
import { ShadowReaderEngine } from './ShadowReaderEngine'

describe('ShadowReaderEngine (读者弹幕与毒点预判模拟器)', () => {
  it('将宽恕词项定位为复核问题，不把词项当成毒点或受众反应', () => {
    const text = '林凡叹了口气道：算了吧，我们退一步海阔天空，原谅了他这次。'
    const result = ShadowReaderEngine.simulate(text, 'ch1')

    expect(result.toxicAlertCount).toBe(0)
    expect(result.danmakus).toHaveLength(1)
    expect(result.danmakus[0]).toMatchObject({
      personaType: 'power_fantasy',
      sentiment: 'review_question',
      sourceQuote: '算了吧',
      isToxicAlert: false,
    })
    expect(text.slice(result.danmakus[0].sourceStart, result.danmakus[0].sourceEnd)).toBe('算了吧')
    expect(result.danmakus[0].content).toContain('事实、否定、转述还是假设')
  })

  it('将场景结果定位为复核问题，不能由词项生成读者喝彩', () => {
    const text = '林凡一剑封喉！全场寂静，在场所有弟子纷纷倒吸一口凉气！'
    const result = ShadowReaderEngine.simulate(text, 'ch2')

    expect(result.sentimentSummary.excited).toBe(0)
    expect(result.danmakus).toHaveLength(1)
    expect(result.danmakus[0]).toMatchObject({
      personaType: 'lore_scholar',
      sentiment: 'review_question',
      sourceQuote: '一剑封喉',
    })
    expect(result.danmakus[0].content).toContain('词项本身不证明')
  })

  it('preserves the negated action in its source quote and asks for review', () => {
    const text = '她没有跪下，而是抵抗命令。'
    const result = ShadowReaderEngine.simulate(text, 'c3')

    expect(result.toxicAlertCount).toBe(0)
    expect(result.danmakus).toHaveLength(1)
    expect(result.danmakus[0]).toMatchObject({
      sentiment: 'review_question',
      isToxicAlert: false,
      sourceQuote: '跪下',
      sourceStart: text.indexOf('跪下'),
      sourceEnd: text.indexOf('跪下') + '跪下'.length,
    })
    expect(result.danmakus[0].content).toContain('否定')
    expect(result.sentimentSummary).toEqual({ rage: 0, applause: 0, suspicious: 0, excited: 0 })
  })

  it('returns no audience reaction or toxicity count for an empty excerpt', () => {
    const result = ShadowReaderEngine.simulate('', 'c-empty')

    expect(result.danmakus).toEqual([])
    expect(result.toxicAlertCount).toBe(0)
    expect(result.sentimentSummary).toEqual({ rage: 0, applause: 0, suspicious: 0, excited: 0 })
  })

  it('sends source identity with the supplied text and leaves edited copies unbound', () => {
    const savedInput = ShadowReaderEngine.buildAnalysisInput('第八章', '她没有跪下。', {
      chapterId: 'chapter-8',
      sourceRevision: 14,
      sourceKind: 'saved-chapter',
    })
    const editedInput = ShadowReaderEngine.buildAnalysisInput('手动摘录', '她没有跪下。', {
      chapterId: 'chapter-8',
      sourceKind: 'edited-copy',
    })

    expect(savedInput.source).toEqual({
      chapterId: 'chapter-8',
      revision: 14,
      kind: 'saved-chapter',
    })
    expect(editedInput.source).toEqual({
      chapterId: 'chapter-8',
      revision: null,
      kind: 'edited-copy',
    })
  })
})
