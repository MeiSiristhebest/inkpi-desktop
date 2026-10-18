import { describe, it, expect } from 'vitest'
import { SubtextCompilerEngine as engine } from './SubtextCompilerEngine'
describe('SubtextCompilerEngine', () => {
  it('preserves exact speech instead of using an emotion template', () => {
    const track = engine.compile('甲“引用”了一句话。', '乙', 'jealousy')
    expect(track.spoken).toBe('甲“引用”了一句话。')
    expect(track.subtext).toBe('')
    expect(track.status).toBe('needs_context')
  })
  it('adds only the author-provided action', () => {
    expect(engine.renderNovelParagraph(engine.compile('我明白了。', '甲', 'fear'))).toBe(
      '甲说：“我明白了。”',
    )
    expect(
      engine.renderNovelParagraph(
        engine.compile('我明白了。', '甲', 'fear', { action: '她收起书。' }),
      ),
    ).toBe('她收起书。\n甲说：“我明白了。”')
  })
})
