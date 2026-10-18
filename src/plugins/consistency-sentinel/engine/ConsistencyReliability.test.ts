import { describe, expect, it } from 'vitest'
import { ConsistencyEngine } from './ConsistencyEngine'
import type { PowerTierSystem } from '../types'

const system: PowerTierSystem = {
  projectId: 'p',
  systemName: '',
  tiers: ['低', '高'],
  specialModifiers: [],
  updatedAt: 0,
}
describe('Consistency author constraints and source boundaries', () => {
  const engine = new ConsistencyEngine()
  it('keeps an explicitly empty partial order incomparable', () => {
    expect(engine.buildTransitiveClosure(['低', '高'], []).get('低')?.size).toBe(0)
    expect(Number.isNaN(engine.compareTiers('低', '高', system, []))).toBe(true)
  })
  it('rejects duplicate nodes and missing endpoints rather than accepting the graph', () => {
    expect(engine.validatePosetDAG(['低', '低'], []).isValid).toBe(false)
    expect(
      engine.validatePosetDAG(['低'], [{ lowerTier: '低', higherTier: '不存在' }]).isValid,
    ).toBe(false)
  })
  it('uses literal names and does not turn negation, dialogue or a different subject into a battle fact', () => {
    const entities = [
      { name: 'A[1]', realm: '低' },
      { name: '乙', realm: '高' },
      { name: '丙', realm: '高' },
    ]
    const text = 'A[1]没有击败乙。A[1]援助丙击败乙。有人说：“A[1]击败乙。”'
    expect(engine.scanTextForInversions(text, entities, system)).toHaveLength(0)
    const source = '\r\n😀A[1]一拳击败了乙。'
    const result = engine.scanTextForInversions(source, entities, system)
    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('candidate')
    expect(result[0].snippet).toBe(source.slice(result[0].startOffset, result[0].endOffset))
  })
  it('keeps death timing unknown and skips action before a recorded death chapter', () => {
    const entities = [{ id: 'one', name: 'A[1]', deathAtChapter: 5 }]
    expect(engine.scanTextForDeceased('A[1]走上前。', entities, 3)).toHaveLength(0)
    expect(engine.scanTextForDeceased('A[1]没有走。', entities, 8)).toHaveLength(0)
    expect(engine.scanTextForDeceased('如果A[1]走上前。', entities, 8)).toHaveLength(0)
    const result = engine.scanTextForDeceased('A[1]走上前。', entities)
    expect(result).toHaveLength(1)
    expect(result[0].explanation).toContain('时间')
  })
})
