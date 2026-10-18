import { describe, expect, it } from 'vitest'
import { RhythmMetronomeEngine } from './RhythmMetronomeEngine'

describe('descriptive rhythm rather than invented diagnosis', () => {
  it('abstains on absent, constant or invalid series', () => {
    for (const series of [[], [1, 2], [7, 7, 7, 7], [1, 2, NaN, 4]])
      expect(RhythmMetronomeEngine.computeAutocorrelationPeriod(series)).toBeNull()
  })
  it('does not invent the first chapter and honors custom cycle lengths', () => {
    const empty = RhythmMetronomeEngine.calculateBeats(0)
    expect(empty.micro.currentStep).toBe(0)
    expect(empty.micro.progressPct).toBe(0)
    const configured = RhythmMetronomeEngine.calculateBeats(5, { microCycleLength: 7 })
    expect(configured.micro.cycleName).toContain('7')
  })
  it('reports no quality score from chapter lengths or author annotations', () => {
    const report = RhythmMetronomeEngine.diagnoseStagnation(0, [])
    expect(report).not.toHaveProperty('pacingPacingScore')
    expect(report.averageCharacters).toBeNull()
    expect(report.diagnostic).toContain('不能')
  })
  it('measures exact sentence spans with Unicode lengths, punctuation and empty lines', () => {
    const text = '😀好。\n\n接着走！没有句号'
    const report = RhythmMetronomeEngine.analyzeText(text)
    expect(report.sentences.map((sentence) => sentence.characters)).toEqual([3, 4, 4])
    expect(report.paragraphCount).toBe(2)
    expect(
      report.sentences.every(
        (sentence) => text.slice(sentence.start, sentence.end) === sentence.quote,
      ),
    ).toBe(true)
    expect(RhythmMetronomeEngine.analyzeText('').sentenceCount).toBe(0)
  })
})
