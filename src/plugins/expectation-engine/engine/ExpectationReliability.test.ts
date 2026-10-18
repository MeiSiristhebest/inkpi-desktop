import { describe, expect, it } from 'vitest'
import { ExpectationEngine, expectationEngine } from './ExpectationEngine'

describe('literal expectation cues and author contracts', () => {
  it('counts short text and keeps an undefined denominator unknown', () => {
    expect(expectationEngine.computeTensionIntegral('打压').suppressionArea).toBe(1)
    expect(expectationEngine.calculateSPR(0, 0)).toBeNull()
    expect(expectationEngine.calculateSPR(3, 0)).toBeNull()
  })
  it('never derives literary quality or audience loss from genre keywords', () => {
    const text = '没有系统，没有打压，也没有突破。'
    const report = expectationEngine.diagnoseGoldenThree(text, text, text)
    expect(report.overallScore).toBeUndefined()
    expect(report.observations.length).toBeGreaterThan(0)
    for (const observation of report.observations)
      expect(text.slice(observation.startOffset, observation.endOffset)).toBe(observation.quote)
    const input = ExpectationEngine.buildAnalysisInput({
      chapters: [{ order: 1, title: '章', content: '甲'.repeat(2000) + '末尾' }],
    })
    expect(JSON.stringify(input)).toContain('末尾')
    expect(JSON.stringify(input)).not.toContain('drop-off-risk')
  })
  it('does not treat missing deadlines or records as fulfillment evidence', () => {
    expect(expectationEngine.auditContracts([], 15).fulfillmentRate).toBeNull()
    expect(
      expectationEngine.auditContracts(
        [{ id: 'c', title: '约定', status: 'planted', promisedResolveChapter: 0 } as any],
        15,
      ).overdueContracts,
    ).toEqual([])
  })
})
