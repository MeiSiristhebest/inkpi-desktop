import { describe, expect, it } from 'vitest'
import { createStoryEntity } from '../../domain/story/entities'
import { createStoryEvent } from '../../domain/story/events'
import { createStoryConstraint } from '../../domain/story/constraints'
import { createNarrativePromise } from '../../domain/story/promises'
import { createStoryRelation } from '../../domain/story/relations'
import { createStoryScene } from '../../domain/story/scenes'
import { createStoryTimeline } from '../../domain/story/timelines'
import {
  createStoryState,
  upsertConstraint,
  upsertEntity,
  upsertEvent,
  upsertPromise,
  upsertRelation,
  upsertScene,
  upsertTimeline,
} from '../../domain/story/storyState'
import type { Provenance } from '../../domain/story/provenance'
import { compileStoryContext, createStoryContextProvider } from './storyContextCompiler'

describe('story context compiler', () => {
  it('separates canonical facts from hypotheses and respects per-bucket maxItems', () => {
    let state = createStoryState(4)
    for (const [id, factLevel] of [
      ['fact-1', 'canonical-fact'],
      ['fact-2', 'canonical-fact'],
      ['guess-1', 'hypothesis'],
    ] as const) {
      state = upsertEntity(
        state,
        createStoryEntity({
          id,
          kind: 'character',
          name: id,
          summary: `${id} summary`,
          provenance: {
            sourceType: factLevel === 'canonical-fact' ? 'author' : 'ai-proposed',
            factLevel,
            confidence: 0.5,
          },
        }),
      )
    }

    const context = compileStoryContext(state, { maxItems: 1 })!
    expect(context.canonicalFacts.map((item) => item.id)).toEqual(['fact-1'])
    expect(context.hypotheses.map((item) => item.id)).toEqual(['guess-1'])
    expect(context.entities.map((item) => item.id)).toEqual(['fact-1', 'fact-2', 'guess-1'])
    expect(context.canonicalFacts.every((item) => item.canonical)).toBe(true)
    expect(context.hypotheses.every((item) => !item.canonical)).toBe(true)
  })

  it('omits hypotheses only when requested and lazily returns no fragment without state', () => {
    let state = createStoryState(5)
    state = upsertEntity(
      state,
      createStoryEntity({
        id: 'guess',
        kind: 'character',
        name: 'guess',
        provenance: { sourceType: 'ai-proposed', factLevel: 'hypothesis' },
      }),
    )
    const context = compileStoryContext(state, { includeHypotheses: false })!
    const provider = createStoryContextProvider(() => undefined)

    expect(context.hypotheses).toEqual([])
    expect(provider.supports({ task: { contextPolicy: { includeProjectState: false } } })).toBe(
      false,
    )
    expect(provider.provide({ task: { contextPolicy: { metadata: {} } } })).toEqual([])
  })

  it('includes legacy module fields in AI context without promoting them to canonical facts', () => {
    let state = createStoryState(5)
    state = upsertEntity(
      state,
      createStoryEntity({
        id: 'legacy:formData:project-1::worldbase',
        kind: 'world-setting',
        name: '云州',
        attributes: {
          legacySource: 'formData',
          data: {
            世界核心规则: '灵脉决定修行者可吸纳的灵气',
            地域别称: ['北境', '云原'],
          },
        },
        provenance: { sourceType: 'derived', factLevel: 'hypothesis' },
      }),
    )

    const context = compileStoryContext(state)!

    expect(context.entities).toContainEqual(
      expect.objectContaining({
        id: 'legacy:formData:project-1::worldbase',
        label: '云州',
        summary: '云州；世界核心规则：灵脉决定修行者可吸纳的灵气；地域别称：北境、云原',
        canonical: false,
      }),
    )
    expect(context.hypotheses.map((item) => item.id)).toContain(
      'legacy:formData:project-1::worldbase',
    )
    expect(context.canonicalFacts).toEqual([])
  })

  it('provides canonical serialized data only when project state is requested', () => {
    const state = createStoryState(6)
    const provider = createStoryContextProvider(() => state)
    const [fragment] = provider.provide({ task: { contextPolicy: { metadata: {} } } })

    expect(fragment).toMatchObject({
      id: expect.stringContaining('story:6:'),
      source: 'creative.story',
      kind: 'story-state',
      data: { revision: 6, canonicalFacts: [], hypotheses: [] },
    })
    expect(fragment.text).toContain('"revision":6')
  })

  it('deduplicates facts so items in canonicalFacts are not duplicated in entities partition', () => {
    let state = createStoryState(7)
    state = upsertEntity(
      state,
      createStoryEntity({
        id: 'fact-char',
        kind: 'character',
        name: '正典角色',
        provenance: { sourceType: 'author', factLevel: 'canonical-fact' },
      }),
    )
    state = upsertEntity(
      state,
      createStoryEntity({
        id: 'hypo-char',
        kind: 'character',
        name: '未定角色',
        provenance: { sourceType: 'ai-proposed', factLevel: 'hypothesis' },
      }),
    )

    const withDedupe = compileStoryContext(state, { deduplicate: true })!
    expect(withDedupe.canonicalFacts.map((f) => f.id)).toContain('fact-char')
    // 由于 fact-char 已经在 canonicalFacts 中收录，entities 分区中去重过滤，只保留未收录的项
    expect(withDedupe.entities.map((e) => e.id)).toEqual(['hypo-char'])

    const withoutDedupe = compileStoryContext(state, { deduplicate: false })!
    expect(withoutDedupe.entities.map((e) => e.id)).toEqual(['fact-char', 'hypo-char'])
  })

  it('deduplicates every collection and keys by collection so shared ids survive', () => {
    const author = { sourceType: 'author', factLevel: 'canonical-fact' } as const
    const inferred = { sourceType: 'ai-proposed', factLevel: 'hypothesis' } as const
    let state = createStoryState(8)
    state = upsertEntity(
      state,
      createStoryEntity({ id: 'e-1', kind: 'character', name: '正典角色', provenance: author }),
    )
    state = upsertRelation(
      state,
      createStoryRelation({
        id: 'r-1',
        sourceEntityId: 'e-1',
        targetEntityId: 'e-1',
        type: 'ally',
        provenance: author,
      }),
    )
    state = upsertConstraint(
      state,
      createStoryConstraint({
        id: 'c-1',
        type: 'rule',
        description: '不可违背',
        severity: 'error',
        provenance: author,
      }),
    )
    // 与正典实体同 id 的推测伏笔：只按 id 去重会把它一起删掉。
    state = upsertPromise(
      state,
      createNarrativePromise({
        id: 'e-1',
        statement: '同 id 的推测伏笔',
        status: 'uncertain',
        provenance: inferred,
      }),
    )

    const deduped = compileStoryContext(state, { deduplicate: true })!
    expect(deduped.canonicalFacts.map((item) => item.id).sort()).toEqual(['c-1', 'e-1', 'r-1'])
    expect(deduped.entities).toEqual([])
    expect(deduped.relations).toEqual([])
    expect(deduped.constraints).toEqual([])
    expect(deduped.promises.map((item) => item.id)).toEqual(['e-1'])

    const kept = compileStoryContext(state, { deduplicate: false })!
    expect(kept.entities.map((item) => item.id)).toEqual(['e-1'])
    expect(kept.promises.map((item) => item.id)).toEqual(['e-1'])
  })

  it('projects promises for continuation tasks by lifecycle status, not by prose', () => {
    const inferred = { sourceType: 'ai-proposed', factLevel: 'hypothesis' } as const
    let state = createStoryState(9)
    for (const [id, status] of [
      ['open-1', 'open'],
      ['worded-1', 'open'],
      ['done-1', 'fulfilled'],
      ['dropped-1', 'abandoned'],
    ] as const) {
      state = upsertPromise(
        state,
        createNarrativePromise({
          id,
          // worded-1 的正文里出现 fulfilled，但状态仍是 open：它必须留在续写上下文里。
          statement: id === 'worded-1' ? 'fulfilled 的说法只是措辞' : `${id} 伏笔`,
          status,
          provenance: inferred,
        }),
      )
    }

    const continuing = compileStoryContext(state, { taskKind: 'creative.continue' })!
    expect(continuing.promises.map((item) => item.id)).toEqual(['open-1', 'worded-1'])

    const auditing = compileStoryContext(state, { taskKind: 'narrative.continuity.audit' })!
    expect(auditing.promises.map((item) => item.id)).toEqual([
      'open-1',
      'worded-1',
      'done-1',
      'dropped-1',
    ])

    const unkinded = compileStoryContext(state)!
    expect(unkinded.promises.map((item) => item.id)).toEqual([
      'open-1',
      'worded-1',
      'done-1',
      'dropped-1',
    ])
  })

  it('carries the task kind through the provider so the projection is reachable from the pipeline', () => {
    let state = createStoryState(10)
    state = upsertEntity(
      state,
      createStoryEntity({
        id: 'fact-char',
        kind: 'character',
        name: '正典角色',
        provenance: { sourceType: 'author', factLevel: 'canonical-fact' },
      }),
    )
    const provider = createStoryContextProvider(() => state)

    const withKind = provider.provide({
      task: { kind: 'creative.continue', contextPolicy: { metadata: {} } },
    })[0]
    const withoutKind = provider.provide({ task: { contextPolicy: { metadata: {} } } })[0]

    // taskKind 存在时 deduplicate 默认开启：正典项只在 canonicalFacts 出现一次。
    expect(withKind.data).toMatchObject({ entities: [] })
    expect(withoutKind.data).toMatchObject({ entities: [{ id: 'fact-char' }] })
    expect(withKind.id).not.toBe(withoutKind.id)
  })

  it('projects chapter-related structured facts with references and source evidence', () => {
    const author: Provenance = {
      sourceType: 'author',
      factLevel: 'canonical-fact',
      confidence: 1,
      sourceDocumentId: 'chapter-3',
      sourceBlockId: 'block-2',
      sourceRevision: 4,
      evidence: [
        {
          documentId: 'chapter-3',
          blockId: 'block-2',
          excerpt: '林青把蓝色车票交给了阿岳。',
          semanticFrom: 18,
          semanticTo: 33,
        },
      ],
    }
    let state = createStoryState(11)
    state = upsertEntity(
      state,
      createStoryEntity({
        id: 'hero',
        kind: 'character',
        name: '林青',
        aliases: ['青子'],
        attributes: { role: 'narrator', age: 19, traits: ['direct', 'careful'] },
        provenance: author,
      }),
    )
    state = upsertEntity(
      state,
      createStoryEntity({
        id: 'friend',
        kind: 'character',
        name: '阿岳',
        provenance: author,
      }),
    )
    state = upsertEntity(
      state,
      createStoryEntity({
        id: 'unrelated',
        kind: 'location',
        name: '南港',
        provenance: author,
      }),
    )
    state = upsertRelation(
      state,
      createStoryRelation({
        id: 'hero-friend',
        sourceEntityId: 'hero',
        targetEntityId: 'friend',
        type: 'ally',
        attributes: { since: 'childhood' },
        provenance: author,
      }),
    )
    state = upsertEvent(
      state,
      createStoryEvent({
        id: 'ticket-handoff',
        type: 'handoff',
        title: '交出车票',
        occurredAt: '冬至夜',
        sceneId: 'scene-current',
        entityIds: ['hero', 'friend'],
        attributes: { item: '蓝色车票' },
        provenance: author,
      }),
    )
    state = upsertScene(
      state,
      createStoryScene({
        id: 'scene-current',
        title: '站台告别',
        documentId: 'chapter-3',
        blockIds: ['block-2'],
        entityIds: ['hero', 'friend'],
        eventIds: ['ticket-handoff'],
        summary: '林青把车票交给阿岳。',
        provenance: author,
      }),
    )
    state = upsertTimeline(
      state,
      createStoryTimeline({
        id: 'main-timeline',
        label: '主线时间',
        eventIds: ['ticket-handoff'],
        constraints: [
          { type: 'after', description: '交票发生在站台告别时', eventIds: ['ticket-handoff'] },
        ],
        provenance: author,
      }),
    )
    state = upsertPromise(
      state,
      createNarrativePromise({
        id: 'blue-ticket',
        statement: '蓝色车票指向北方车站',
        status: 'open',
        evidence: author.evidence,
        provenance: author,
      }),
    )
    state = upsertConstraint(
      state,
      createStoryConstraint({
        id: 'hero-rule',
        type: 'knowledge',
        description: '林青没有见过车票背面的地址。',
        subjectIds: ['hero'],
        severity: 'warning',
        provenance: author,
      }),
    )
    state = upsertConstraint(
      state,
      createStoryConstraint({
        id: 'world-rule',
        type: 'world',
        description: '列车在午夜后停止运行。',
        subjectIds: [],
        severity: 'error',
        provenance: author,
      }),
    )

    const context = compileStoryContext(state, {
      taskKind: 'creative.continue',
      deduplicate: false,
      activeEntityIds: ['hero', 'friend'],
      activePromiseIds: ['blue-ticket'],
      currentDocumentId: 'chapter-3',
      maxCharacters: 20_000,
    })!
    const entity = context.entities.find((item) => item.id === 'hero')!
    const relation = context.relations.find((item) => item.id === 'hero-friend')!
    const event = context.events.find((item) => item.id === 'ticket-handoff')!

    expect(context.entities.map((item) => item.id)).toEqual(['hero', 'friend'])
    expect(entity.details).toMatchObject({
      kind: 'character',
      aliases: ['青子'],
      attributes: { role: 'narrator', age: 19, traits: ['direct', 'careful'] },
    })
    expect(entity.provenance).toMatchObject({
      sourceDocumentId: 'chapter-3',
      sourceBlockId: 'block-2',
      sourceRevision: 4,
      evidence: [
        { documentId: 'chapter-3', blockId: 'block-2', excerpt: '林青把蓝色车票交给了阿岳。' },
      ],
    })
    expect(relation.details).toMatchObject({
      type: 'ally',
      source: { id: 'hero', label: '林青' },
      target: { id: 'friend', label: '阿岳' },
      attributes: { since: 'childhood' },
    })
    expect(event.details).toMatchObject({
      occurredAt: '冬至夜',
      sceneId: 'scene-current',
      entities: [
        { id: 'hero', label: '林青' },
        { id: 'friend', label: '阿岳' },
      ],
    })
    expect(context.scenes[0].details).toMatchObject({
      documentId: 'chapter-3',
      blockIds: ['block-2'],
    })
    expect(context.timelines[0].details).toMatchObject({
      constraints: [{ type: 'after', description: '交票发生在站台告别时' }],
    })
    expect(context.promises[0]).toMatchObject({
      id: 'blue-ticket',
      status: 'open',
      provenance: { evidence: [{ blockId: 'block-2' }] },
    })
    expect(context.constraints.map((item) => item.id)).toEqual(['hero-rule', 'world-rule'])
    expect(JSON.stringify(context)).not.toContain('unrelated')
  })

  it('keeps the projected story context inside its serialized character budget', () => {
    let state = createStoryState(12)
    for (let index = 0; index < 24; index += 1) {
      state = upsertEntity(
        state,
        createStoryEntity({
          id: `character-${index}`,
          kind: 'character',
          name: `人物${index}`,
          summary: '背景'.repeat(400),
          attributes: { history: '经历'.repeat(400) },
          provenance: { sourceType: 'author', factLevel: 'canonical-fact', confidence: 1 },
        }),
      )
    }

    const context = compileStoryContext(state, {
      taskKind: 'creative.continue',
      maxCharacters: 1_200,
    })!

    expect(JSON.stringify(context).length).toBeLessThanOrEqual(1_200)
    expect(context.canonicalFacts.length).toBeLessThan(24)
  })
})
