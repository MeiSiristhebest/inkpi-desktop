import { describe, expect, it } from 'vitest'
import {
  createProvenance,
  createStoryEntity,
  createStoryState,
  deserializeStoryState,
  serializeStoryState,
  upsertEntity,
} from './index'

describe('StoryState JSON wire boundary', () => {
  it('produces deterministic JSON and round-trips a fully populated state', () => {
    const state = upsertEntity(
      createStoryState(7),
      createStoryEntity({
        id: 'hero',
        kind: 'character',
        name: 'Hero',
        aliases: ['主角'],
        attributes: { nested: { answer: 42 }, tags: ['a', 'b'] },
        provenance: createProvenance({
          sourceType: 'author',
          factLevel: 'canonical-fact',
          sourceDocumentId: 'chapter-1',
          evidence: [{ documentId: 'chapter-1', semanticFrom: 0, semanticTo: 4 }],
        }),
      }),
    )

    const encoded = serializeStoryState(state)
    expect(encoded).toContain('"revision":7')
    expect(deserializeStoryState(encoded)).toEqual(state)

    const differentlyOrdered = JSON.stringify({
      constraints: state.constraints,
      promises: state.promises,
      timelines: state.timelines,
      scenes: state.scenes,
      events: state.events,
      relations: state.relations,
      entities: state.entities,
      revision: state.revision,
    })
    expect(serializeStoryState(deserializeStoryState(differentlyOrdered))).toBe(encoded)
  })

  it('rejects malformed, unknown, and non-JSON StoryState values', () => {
    expect(() => deserializeStoryState('{')).toThrow(/valid JSON/)
    expect(() =>
      deserializeStoryState(JSON.stringify({ ...createStoryState(), extra: true })),
    ).toThrow(/unknown field/)
    expect(() =>
      serializeStoryState({
        ...createStoryState(),
        entities: {
          bad: {
            id: 'bad',
            kind: 'character',
            name: 'Bad',
            aliases: [],
            attributes: { bad: Number.NaN },
            provenance: createProvenance({ sourceType: 'author', factLevel: 'canonical-fact' }),
          },
        },
      }),
    ).toThrow(/non-finite/)
  })
})
