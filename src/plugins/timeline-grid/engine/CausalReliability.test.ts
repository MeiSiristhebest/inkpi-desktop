import { describe, expect, it } from 'vitest'
import { CausalEngine } from './CausalEngine'
import type { TimelineNode } from '../types'

const node = (id: string, prerequisites: string[] = [], chapterOrder = 1): TimelineNode => ({
  id,
  prerequisites,
  chapterOrder,
  projectId: 'p',
  threadId: 't',
  eventTitle: id,
  summary: '',
  status: 'planned',
  causalOutcome: '',
  relatedEntityIds: [],
  emotionalPolarity: 0,
  createdAt: 0,
  updatedAt: 0,
})
const engine = new CausalEngine()
describe('dependency graph boundaries', () => {
  it('identifies exact cycle members, not blocked descendants', () => {
    const nodes = [node('a', ['b']), node('b', ['a']), node('downstream', ['b'])]
    expect(engine.detectCausalCycles(nodes)[0].nodeIds.sort()).toEqual(['a', 'b'])
  })
  it('reports independent cycles separately, including self-dependencies', () => {
    const cycles = engine.detectCausalCycles([
      node('a', ['b']),
      node('b', ['a']),
      node('self', ['self']),
    ])
    expect(
      cycles.map((cycle) => cycle.nodeIds.sort()).sort((a, b) => a[0].localeCompare(b[0])),
    ).toEqual([['a', 'b'], ['self']])
  })
  it('does not return a valid ordering with dangling prerequisites or duplicate IDs', () => {
    const missing = [node('a', ['gone'])]
    expect(engine.topoSort(missing)).toBeNull()
    expect(
      engine
        .auditAllConflicts(missing)
        .some((conflict) => conflict.type === 'missing_prerequisite'),
    ).toBe(true)
    expect(
      engine
        .auditAllConflicts([node('a'), node('a')])
        .some((conflict) => conflict.type === 'invalid_definition'),
    ).toBe(true)
  })
  it('only treats events on registered narrative threads as same-line collisions', () => {
    const orphanEvents = [
      { ...node('orphan-a', [], 2), threadId: 'missing-thread' },
      { ...node('orphan-b', [], 2), threadId: 'missing-thread' },
    ]
    expect(
      engine
        .auditAllConflicts(orphanEvents, new Set())
        .some((conflict) => conflict.type === 'chapter_collision'),
    ).toBe(false)

    const registeredEvents = orphanEvents.map((event) => ({ ...event, threadId: 'registered' }))
    expect(
      engine
        .auditAllConflicts(registeredEvents, new Set(['registered']))
        .some((conflict) => conflict.type === 'chapter_collision'),
    ).toBe(true)
  })
  it('does not manufacture emotional annotations in chapter gaps', () => {
    const curve = engine.computeEmotionalCurve([node('a', [], 1), node('b', [], 1000)], 1)
    expect(curve.map((point) => point.chapter)).toEqual([1, 1000])
  })
})
