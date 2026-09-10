import { describe, expect, it } from 'vitest'
import { createStoryEntity } from '../../domain/story/entities'
import { createStoryState, upsertEntity } from '../../domain/story/storyState'
import { compileStoryContext, createStoryContextProvider } from './storyContextCompiler'

describe('story context compiler', () => {
  it('separates canonical facts from hypotheses and respects per-bucket maxItems', () => {
    let state = createStoryState(4)
    for (const [id, factLevel] of [['fact-1', 'canonical-fact'], ['fact-2', 'canonical-fact'], ['guess-1', 'hypothesis']] as const) {
      state = upsertEntity(state, createStoryEntity({
        id,
        kind: 'character',
        name: id,
        summary: `${id} summary`,
        provenance: { sourceType: factLevel === 'canonical-fact' ? 'author' : 'ai-proposed', factLevel, confidence: 0.5 },
      }))
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
    state = upsertEntity(state, createStoryEntity({
      id: 'guess', kind: 'character', name: 'guess',
      provenance: { sourceType: 'ai-proposed', factLevel: 'hypothesis' },
    }))
    const context = compileStoryContext(state, { includeHypotheses: false })!
    const provider = createStoryContextProvider(() => undefined)

    expect(context.hypotheses).toEqual([])
    expect(provider.supports({ task: { contextPolicy: { includeProjectState: false } } })).toBe(false)
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
})
