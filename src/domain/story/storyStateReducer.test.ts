import type { DomainChange, DomainChangeSet } from '@inkpi/protocol'
import { describe, expect, it } from 'vitest'
import { createDomainChangeSet } from '../sync/domainChangeSet'
import {
  createProvenance,
  createStoryEntity,
  createStoryState,
  reduceStoryStateProjection,
  replayStoryStateProjection,
} from './index'

const provenance = createProvenance({
  sourceType: 'author',
  factLevel: 'canonical-fact',
  confidence: 1,
})

describe('StoryState DomainChangeSet reducer', () => {
  it('applies typed story records while keeping the domain cursor separate', () => {
    const entity = createStoryEntity({
      id: 'hero',
      kind: 'character',
      name: 'Hero',
      provenance,
    })
    const changeSet = makeChangeSet(0, [
      change('entity-1', 'story.entity', 'hero', 'upsert', entity, 1),
      change(
        'promise-1',
        'narrative.promise',
        'door',
        'upsert',
        {
          id: 'door',
          statement: 'The door opens.',
          status: 'open',
          evidence: [],
          provenance,
        },
        2,
      ),
      change('document-1', 'document', 'chapter-1', 'upsert', { title: 'Chapter 1' }, 1),
    ])
    const initial = { domainRevision: 0, state: createStoryState() }

    const next = reduceStoryStateProjection(initial, changeSet)

    expect(next.domainRevision).toBe(1)
    expect(next.state.entities.hero).toEqual(entity)
    expect(next.state.promises.door.statement).toBe('The door opens.')
    expect(next.state.revision).toBe(2)
    expect(initial.state).toEqual(createStoryState())
  })

  it('replays full StoryState snapshots and typed deletes without losing semantic revision', () => {
    const entity = createStoryEntity({
      id: 'hero',
      kind: 'character',
      name: 'Hero',
      provenance,
    })
    const snapshot = {
      ...createStoryState(7),
      entities: { [entity.id]: entity },
    }
    const first = makeChangeSet(0, [change('state-1', 'story-state', 'workspace-1', 'upsert', snapshot, 7)])
    const second = makeChangeSet(1, [change('entity-2', 'story.entity', 'hero', 'delete', undefined, 8)])

    const result = replayStoryStateProjection([first, second])

    expect(result.domainRevision).toBe(2)
    expect(result.state.entities).toEqual({})
    expect(result.state.revision).toBe(8)
  })

  it('rejects gaps, checksum corruption, and malformed typed payloads', () => {
    const initial = { domainRevision: 0, state: createStoryState() }
    const valid = makeChangeSet(0, [
      change('entity-1', 'story.entity', 'hero', 'upsert', {
        id: 'different',
        provenance,
      }, 1),
    ])

    expect(() => reduceStoryStateProjection(initial, { ...valid, checksum: '00000000' })).toThrow(/checksum/)
    expect(() => reduceStoryStateProjection({ ...initial, domainRevision: 2 }, valid)).toThrow(/revision conflict/)
    expect(() => reduceStoryStateProjection(initial, valid)).toThrow(/id mismatch/)
  })
})

function change(
  id: string,
  aggregateType: string,
  aggregateId: string,
  operation: DomainChange['operation'],
  payload: unknown,
  revision: number,
): DomainChange {
  return { id, aggregateType, aggregateId, operation, payload, revision, occurredAt: revision }
}

function makeChangeSet(baseRevision: number, changes: DomainChange[]): DomainChangeSet {
  return createDomainChangeSet({
    id: `story-reducer-${baseRevision}-${changes.map((item) => item.id).join('-')}`,
    workspaceId: 'workspace-1',
    sourceDeviceId: 'desktop-test',
    baseRevision,
    changes,
    createdAt: baseRevision + 1,
  })
}
