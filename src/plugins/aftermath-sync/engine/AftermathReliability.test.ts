import { describe, expect, it } from 'vitest'
import { AftermathEngine } from './AftermathEngine'
const roster = [
  { id: 'a', name: 'A[1]', category: 'character' as const, currentTier: '初阶' },
  { id: 'b', name: '乙', category: 'character' as const },
  { id: 'i', name: '青铜剑', category: 'item' as const },
]
describe('Aftermath source candidates', () => {
  it('does not rewrite facts from negatives, dialogue, conditional plans or other subjects', () => {
    const result = AftermathEngine.analyzeChapter(
      'A[1]没有突破到金丹初期。A[1]看着乙突破到金丹初期。有人说：“A[1]突破到金丹初期。”如果A[1]突破到金丹初期。',
      'c',
      1,
      roster,
    )
    expect(result.patches.filter((patch) => patch.entityId === 'a')).toHaveLength(0)
    expect(result.patches).toEqual([
      expect.objectContaining({
        entityId: 'b',
        evidenceStatus: 'candidate',
        afterValue: '金丹初期',
      }),
    ])
  })
  it('recognizes the actual item-before-verb acquisition form and retains exact original offsets', () => {
    const text = '\r\n😀A[1]将青铜剑收入囊中。'
    const result = AftermathEngine.analyzeChapter(text, 'c', 1, roster)
    expect(result.patches).toHaveLength(1)
    const patch = result.patches[0]
    expect(patch.changeType).toBe('ownership_transfer')
    expect(patch.afterValue).toBe('A[1]')
    expect(patch.evidenceStatus).toBe('candidate')
    expect(patch.evidenceSnippet).toBe(text.slice(patch.evidenceStart, patch.evidenceEnd))
  })
  it('does not infer ownership from merely holding an item', () => {
    expect(AftermathEngine.analyzeChapter('乙接过青铜剑。', 'c', 1, roster).patches).toHaveLength(0)
  })
})
