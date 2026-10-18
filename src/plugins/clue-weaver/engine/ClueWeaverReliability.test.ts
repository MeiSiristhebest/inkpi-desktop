import { describe, expect, it } from 'vitest'
import { ClueWeaverEngine } from './ClueWeaverEngine'
import type { ClueItem, ClueCognitionRecord } from '../types'

const clue: ClueItem = {
  id: 'secret',
  projectId: 'p',
  title: '毒药',
  description: '',
  keywords: ['毒药'],
  category: 'secret',
  status: 'active',
  createdAt: 0,
  updatedAt: 0,
}
const cognition: ClueCognitionRecord = {
  id: 'knowledge',
  projectId: 'p',
  clueId: clue.id,
  characterId: 'a',
  characterName: '甲[1]',
  epistemicState: 'blind',
  updatedAt: 0,
}
const engine = new ClueWeaverEngine()
describe('knowledge observations without asserted truth', () => {
  it('separates an absent record from an explicit blind state', () => {
    expect(
      engine.getCognitionMatrix([{ id: 'a', name: '甲' }], [clue], [])[0].clueStates[0].state,
    ).toBe('unrecorded')
    const advantage = engine.computeAdvantage('a', '甲', 'b', '乙', [clue], [])
    expect(advantage.advantageScore).toBeNull()
    expect(advantage.unrecordedPairs).toBe(2)
  })
  it('keeps negated or interrogative mentions as literal review candidates, with exact positions', () => {
    const text = '\n甲[1]说：“这不是毒药，你说的毒药是真的吗？”'
    const findings = engine.scanGodViewLeakage(text, [clue], [cognition])
    expect(findings).toHaveLength(2)
    expect(
      findings.every(
        (finding) =>
          finding.status === 'candidate' &&
          text.slice(finding.startOffset, finding.endOffset) === finding.snippet,
      ),
    ).toBe(true)
    expect(findings[0].reason).toContain('不能证明')
  })
  it('does not guess a speaker or a blind state from arbitrary prose', () => {
    expect(engine.scanGodViewLeakage('路过的旅客说：“毒药。”', [clue], [cognition])).toEqual([])
    expect(engine.scanGodViewLeakage('甲[1]说：“毒药。”', [clue], [])).toEqual([])
  })
  it('uses chapter-specific acquisition time rather than applying future knowledge backwards', () => {
    const known = { ...cognition, epistemicState: 'known' as const, learnedAtChapter: 8 }
    expect(engine.scanGodViewLeakage('甲[1]说：“毒药。”', [clue], [known], 3)).toHaveLength(1)
    expect(engine.scanGodViewLeakage('甲[1]说：“毒药。”', [clue], [known], 9)).toHaveLength(0)
  })
})
