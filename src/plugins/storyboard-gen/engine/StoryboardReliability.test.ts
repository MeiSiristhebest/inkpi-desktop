import { describe, expect, it } from 'vitest'
import { StoryboardEngine } from './StoryboardEngine'
describe('actual scene storyboards', () => {
  it('does not produce frames or fictional characters from blank source', () => {
    const result = StoryboardEngine.extractStoryboard('c', '', '')
    expect(result.frames).toEqual([])
    expect(result.suggestedCharacters).toEqual([])
  })
  it('uses actual short source passages with exact evidence and preserves the ending in analysis input', () => {
    const text = '开门。\r\n她等待。\r\n结束。'
    const result = StoryboardEngine.extractStoryboard('c', '采访', text)
    expect(result.frames).toHaveLength(3)
    for (const frame of result.frames)
      expect(text.slice(frame.sourceStart, frame.sourceEnd)).toBe(frame.sourceQuote)
    expect(JSON.stringify(result)).not.toMatch(/修士|雷暴|胜者|杀招|道袍|强敌/)
    const longText = '前'.repeat(1900) + '真实结尾'
    expect(
      StoryboardEngine.buildAnalysisInput({ chapterTitle: '章', chapterText: longText })
        .chapterText,
    ).toBe(longText)
  })
})
