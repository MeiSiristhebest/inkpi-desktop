import { describe, it, expect } from 'vitest'
import { buildJitQuery } from './jitQueryBuilder'
import type { StoryState } from '../../domain/story'

describe('JitQueryBuilder', () => {
  const mockStoryState: StoryState = {
    revision: 1,
    entities: {
      'ent-1': {
        id: 'ent-1',
        kind: 'character',
        name: '楚行云',
        aliases: ['楚师兄', '青云首徒'],
        summary: '真传大弟子',
        provenance: { sourceType: 'author', factLevel: 'canonical-fact' },
      },
      'ent-2': {
        id: 'ent-2',
        kind: 'item',
        name: '九阳焚天剑',
        aliases: ['焚天残剑'],
        summary: '本命神兵',
        provenance: { sourceType: 'author', factLevel: 'canonical-fact' },
      },
      'ent-3': {
        id: 'ent-3',
        kind: 'character',
        name: '幽冥老祖',
        aliases: [],
        summary: '魔道巨擘',
        provenance: { sourceType: 'author', factLevel: 'canonical-fact' },
      },
    },
    relations: {
      'rel-1': {
        id: 'rel-1',
        sourceEntityId: 'ent-1',
        targetEntityId: 'ent-2',
        type: 'owns',
        attributes: {},
        provenance: { sourceType: 'author', factLevel: 'canonical-fact' },
      },
    },
    events: {},
    scenes: {},
    timelines: {},
    promises: {
      'prom-1': {
        id: 'prom-1',
        statement: '焚天残剑将在寒潭觉醒',
        status: 'open',
        relatedEntityIds: ['ent-2'],
        provenance: { sourceType: 'author', factLevel: 'canonical-fact' },
      },
      'prom-resolved': {
        id: 'prom-resolved',
        statement: '已经完成的历史伏笔',
        status: 'fulfilled',
        relatedEntityIds: ['ent-1'],
        provenance: { sourceType: 'author', factLevel: 'canonical-fact' },
      },
    },
    constraints: {},
  }

  it('matches entity names and aliases from user prompt and document text', () => {
    const result = buildJitQuery({
      workspaceId: 'test-ws',
      currentDocumentText: '后山寂静无声。青云首徒拔剑而立。',
      userPrompt: '续写青云首徒遭遇魔修的场景',
      storyState: mockStoryState,
    })

    expect(result.matchedEntityIds).toContain('ent-1')
    expect(result.keywords).toContain('青云首徒')
    expect(result.activeReferences).toContain('楚行云')
  })

  it('performs 1-hop relation expansion for matched entities', () => {
    // 文本中仅提到了「楚行云」
    const result = buildJitQuery({
      workspaceId: 'test-ws',
      currentDocumentText: '楚行云注视着寒潭深处。',
      storyState: mockStoryState,
    })

    expect(result.matchedEntityIds).toEqual(['ent-1'])
    // 1-hop 扩散应包含其关联神兵「九阳焚天剑」
    expect(result.expandedEntityIds).toContain('ent-2')
    expect(result.activeReferences).toContain('楚行云')
    expect(result.activeReferences).toContain('九阳焚天剑')
  })

  it('associates relevant open promises but ignores fulfilled ones', () => {
    const result = buildJitQuery({
      workspaceId: 'test-ws',
      currentDocumentText: '楚行云握紧了剑柄。',
      storyState: mockStoryState,
    })

    // 因为 ent-2 是 1-hop 展开实体，且 prom-1 与 ent-2 关联且为 open 状态
    expect(result.relevantPromiseIds).toContain('prom-1')
    expect(result.relevantPromiseIds).not.toContain('prom-resolved')
  })

  it('handles empty state gracefully without errors', () => {
    const result = buildJitQuery({
      workspaceId: 'test-ws',
      currentDocumentText: '平淡无奇的一句话。',
    })

    expect(result.matchedEntityIds).toEqual([])
    expect(result.expandedEntityIds).toEqual([])
    expect(result.keywords).toEqual([])
  })
})
