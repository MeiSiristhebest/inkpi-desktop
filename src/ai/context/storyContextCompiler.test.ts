import { describe, expect, it } from 'vitest'
import { createStoryEntity } from '../../domain/story/entities'
import { createStoryConstraint } from '../../domain/story/constraints'
import { createNarrativePromise } from '../../domain/story/promises'
import { createStoryRelation } from '../../domain/story/relations'
import {
  createStoryState,
  upsertConstraint,
  upsertEntity,
  upsertPromise,
  upsertRelation,
} from '../../domain/story/storyState'
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
})
