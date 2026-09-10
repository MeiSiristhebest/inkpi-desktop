import { describe, expect, it } from 'vitest'
import {
  projectPluginRecordsToStoryState,
  STORY_PLUGIN_COLLECTION_MAP,
  type StoryPluginCollectionInput,
} from './pluginProjection'

const authorFact = {
  sourceType: 'author',
  factLevel: 'canonical-fact',
  sourceDocumentId: 'chapter-1',
  evidence: [{ documentId: 'chapter-1', excerpt: '原始事实' }],
}

function source(
  sourceId: string,
  collection: string,
  records: readonly unknown[],
): StoryPluginCollectionInput {
  return { sourceId, collection, records }
}

describe('canonical StoryState plugin projection', () => {
  it('maps Codex, Timeline, and Promise plugin records through explicit routes', () => {
    const state = projectPluginRecordsToStoryState(
      [
        source('living-codex', 'entity', [
          {
            id: 'entity:hero',
            name: 'Hero',
            category: 'character',
            aliases: ['主角', 'Hero'],
            attributes: { realm: { rank: 3 }, faction: '江湖' },
            relations: [],
            summary: 'canonical hero',
            createdAt: 1,
            updatedAt: 2,
            provenance: authorFact,
          },
        ]),
        source('timeline-grid', 'thread', [
          {
            id: 'timeline:main',
            projectId: 'project-1',
            name: '主线',
            color: '#fff',
            characterIds: ['entity:hero'],
            order: 0,
            provenance: authorFact,
          },
        ]),
        source('timeline-grid', 'node', [
          {
            id: 'event:arrival',
            projectId: 'project-1',
            threadId: 'timeline:main',
            chapterOrder: 2,
            eventTitle: '抵达城门',
            summary: '英雄抵达城门',
            status: 'planned',
            prerequisites: [],
            causalOutcome: '进入城市',
            relatedEntityIds: ['entity:hero'],
            emotionalPolarity: 0.2,
            createdAt: 1,
            updatedAt: 2,
            provenance: { ...authorFact, factLevel: 'hypothesis' },
          },
        ]),
        source('promise-ledger', 'entry', [
          {
            id: 'promise:door',
            projectId: 'project-1',
            clueName: '锁门之谜',
            tier: 'main_plot',
            plantChapter: 1,
            plantNote: '这扇门终将打开',
            dueChapterLimit: 10,
            softDeadline: 6,
            status: 'planted',
            memoryDecayLambda: 0.05,
            progressHistory: [],
            payoffChapter: undefined,
            relatedEntityIds: ['entity:hero'],
            relatedChapterIds: [],
            createdAt: 1,
            updatedAt: 2,
            provenance: authorFact,
          },
        ]),
      ],
      { revision: 7 },
    )

    expect(state.revision).toBe(7)
    expect(state.entities['entity:hero']).toMatchObject({
      id: 'entity:hero',
      kind: 'character',
      name: 'Hero',
      aliases: ['Hero', '主角'],
    })
    expect(state.timelines['timeline:main']).toMatchObject({
      id: 'timeline:main',
      label: '主线',
      eventIds: [],
    })
    expect(state.events['event:arrival']).toMatchObject({
      type: 'timeline-node',
      title: '抵达城门',
      occurredAt: 2,
      entityIds: ['entity:hero'],
      attributes: { threadId: 'timeline:main', causalOutcome: '进入城市' },
    })
    expect(state.promises['promise:door']).toMatchObject({
      statement: '这扇门终将打开',
      status: 'open',
      introducedAt: 1,
    })
  })

  it('requires every record to carry a valid id and complete provenance', () => {
    const base = {
      id: 'entity:one',
      name: 'One',
      category: 'character',
      provenance: authorFact,
    }
    expect(() =>
      projectPluginRecordsToStoryState([source('living-codex', 'entity', [{ ...base, id: '' }])]),
    ).toThrow(/id/i)
    expect(() =>
      projectPluginRecordsToStoryState([
        source('living-codex', 'entity', [{ ...base, provenance: undefined }]),
      ]),
    ).toThrow(/missing provenance/i)
    expect(() =>
      projectPluginRecordsToStoryState([
        source('living-codex', 'entity', [
          { ...base, provenance: { sourceType: 'unknown', factLevel: 'canonical-fact' } },
        ]),
      ]),
    ).toThrow(/sourceType/i)
    expect(() =>
      projectPluginRecordsToStoryState([
        source('living-codex', 'entity', [
          { ...base, provenance: { sourceType: 'author', factLevel: 'not-a-fact' } },
        ]),
      ]),
    ).toThrow(/factLevel/i)
  })

  it('rejects unknown sources, unknown collections, and duplicate ids globally', () => {
    const entity = { id: 'same', name: 'Same', category: 'term', provenance: authorFact }
    expect(() =>
      projectPluginRecordsToStoryState([source('unknown-plugin', 'entity', [entity])]),
    ).toThrow(/unknown.*source id/i)
    expect(() =>
      projectPluginRecordsToStoryState([source('living-codex', 'unknown', [entity])]),
    ).toThrow(/unknown.*collection/i)
    expect(() =>
      projectPluginRecordsToStoryState([
        source('living-codex', 'entity', [entity]),
        source('promise-ledger', 'entry', [
          { id: 'same', clueName: 'duplicate', status: 'planted', provenance: authorFact },
        ]),
      ]),
    ).toThrow(/duplicate.*id/i)
  })

  it('deep-clones and deterministically orders records without reading repositories', () => {
    const attributes = { nested: { count: 1 } }
    const first = {
      id: 'entity:b',
      name: 'B',
      category: 'term',
      aliases: ['z'],
      attributes,
      provenance: authorFact,
    }
    const second = {
      id: 'entity:a',
      name: 'A',
      category: 'term',
      aliases: ['a'],
      attributes: {},
      provenance: authorFact,
    }
    const forward = projectPluginRecordsToStoryState([
      source('living-codex', 'entities', [first, second]),
    ])
    const reverse = projectPluginRecordsToStoryState([
      source('living-codex', 'entities', [second, first]),
    ])

    expect(Object.keys(forward.entities)).toEqual(['entity:a', 'entity:b'])
    expect(forward).toEqual(reverse)

    attributes.nested.count = 99
    first.aliases[0] = 'changed'
    ;(forward.entities['entity:b'].attributes.nested as { count: number }).count = 7
    expect(reverse.entities['entity:b'].attributes.nested).toEqual({ count: 1 })
    expect(first.aliases).toEqual(['changed'])
    expect(forward.entities['entity:b'].aliases).toEqual(['z'])
  })

  it('exposes only explicit plugin/source collection routes', () => {
    expect(STORY_PLUGIN_COLLECTION_MAP).toEqual({
      'living-codex': { entity: 'entities', entities: 'entities' },
      'timeline-grid': {
        thread: 'timelines',
        threads: 'timelines',
        timeline: 'timelines',
        timelines: 'timelines',
        node: 'events',
        nodes: 'events',
        event: 'events',
        events: 'events',
      },
      'promise-ledger': {
        entry: 'promises',
        entries: 'promises',
        promise: 'promises',
        promises: 'promises',
      },
    })
  })
})
