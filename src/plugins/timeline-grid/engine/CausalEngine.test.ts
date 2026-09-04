import { describe, it, expect } from 'vitest'
import { CausalEngine } from './CausalEngine'
import type { TimelineNode } from '../types'

const makeNode = (overrides: Partial<TimelineNode> = {}): TimelineNode => ({
  id: 'node-1',
  projectId: 'proj1',
  threadId: 'main',
  chapterOrder: 1,
  eventTitle: '主角穿越至修仙界',
  summary: '开局穿越',
  status: 'planned',
  prerequisites: [],
  causalOutcome: '获得残破青铜鼎',
  relatedEntityIds: [],
  emotionalPolarity: 0.2,
  createdAt: 100,
  updatedAt: 100,
  ...overrides,
})

describe('CausalEngine — 因果拓扑分析、环路死锁与时间悖论检测', () => {
  const engine = new CausalEngine()

  it('detects no cycles in a clean DAG and computes valid topoSort', () => {
    const n1 = makeNode({ id: 'n1', chapterOrder: 1, prerequisites: [] })
    const n2 = makeNode({ id: 'n2', chapterOrder: 2, prerequisites: ['n1'] })
    const n3 = makeNode({ id: 'n3', chapterOrder: 3, prerequisites: ['n2'] })

    const nodes = [n1, n2, n3]
    const cycles = engine.detectCausalCycles(nodes)
    expect(cycles).toHaveLength(0)

    const sorted = engine.topoSort(nodes)
    expect(sorted).not.toBeNull()
    expect(sorted!.map((n) => n.id)).toEqual(['n1', 'n2', 'n3'])
  })

  it('detects 2-node and multi-node causal cycles (Kahn cycle deadlock)', () => {
    // n1 -> n2 -> n3 -> n1 (环路)
    const n1 = makeNode({ id: 'n1', eventTitle: '事件A', prerequisites: ['n3'] })
    const n2 = makeNode({ id: 'n2', eventTitle: '事件B', prerequisites: ['n1'] })
    const n3 = makeNode({ id: 'n3', eventTitle: '事件C', prerequisites: ['n2'] })

    const nodes = [n1, n2, n3]
    const cycles = engine.detectCausalCycles(nodes)
    expect(cycles).toHaveLength(1)
    expect(cycles[0].type).toBe('causal_cycle')
    expect(cycles[0].severity).toBe('error')
    expect(cycles[0].nodeIds).toContain('n1')
    expect(cycles[0].nodeIds).toContain('n2')
    expect(cycles[0].nodeIds).toContain('n3')

    const sorted = engine.topoSort(nodes)
    expect(sorted).toBeNull()
  })

  it('detects temporal paradoxes when pre-requisite happens in future chapters', () => {
    // n2 发生在第 2 章，但依赖第 5 章才发生的 n1
    const n1 = makeNode({ id: 'n1', chapterOrder: 5, eventTitle: '击败魔皇' })
    const n2 = makeNode({ id: 'n2', chapterOrder: 2, eventTitle: '主角顿悟神力', prerequisites: ['n1'] })

    const paradoxes = engine.detectTemporalParadoxes([n1, n2])
    expect(paradoxes).toHaveLength(1)
    expect(paradoxes[0].type).toBe('temporal_paradox')
    expect(paradoxes[0].severity).toBe('error')
    expect(paradoxes[0].description).toContain('因果倒置')
  })

  it('detects chapter collision on the same thread', () => {
    const n1 = makeNode({ id: 'n1', threadId: 'thread-a', chapterOrder: 3, eventTitle: '进宗门' })
    const n2 = makeNode({ id: 'n2', threadId: 'thread-a', chapterOrder: 3, eventTitle: '偶遇师姐' })

    const collisions = engine.detectChapterCollisions([n1, n2])
    expect(collisions).toHaveLength(1)
    expect(collisions[0].type).toBe('chapter_collision')
    expect(collisions[0].severity).toBe('warning')
  })

  it('computes emotional curve points across chapters', () => {
    const nodes = [
      makeNode({ id: 'n1', chapterOrder: 1, emotionalPolarity: -0.8 }),
      makeNode({ id: 'n2', chapterOrder: 2, emotionalPolarity: -0.2 }),
      makeNode({ id: 'n3', chapterOrder: 3, emotionalPolarity: 0.9 }),
    ]

    const curve = engine.computeEmotionalCurve(nodes, 3)
    expect(curve.length).toBeGreaterThanOrEqual(3)
    expect(curve[0].chapter).toBe(1)
    expect(curve[curve.length - 1].chapter).toBe(3)
  })
})
