import { describe, expect, it } from 'vitest'
import {
  compareWorldPack,
  stableValue,
  type WorldPackEntitySnapshot,
  type WorldPackSnapshot,
} from './worldPack'

function entity(
  id: string,
  name: string,
  overrides: Partial<WorldPackEntitySnapshot> = {},
): WorldPackEntitySnapshot {
  return {
    id,
    name,
    aliases: [],
    category: 'character',
    attributes: {},
    relations: [],
    summary: `${name} summary`,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

function snapshot(entities: WorldPackEntitySnapshot[] = []): WorldPackSnapshot {
  return {
    id: 'pack-1',
    schemaVersion: 1,
    sourceProjectId: 'source',
    sourceProjectName: 'Source',
    version: 1,
    createdAt: 10,
    worldbase: {
      origin: 'same',
      tone: 'source tone',
      era: 'ancient',
      empty: '',
    },
    entities,
  }
}

describe('compareWorldPack', () => {
  it('classifies additive, matching, conflicting, and target-only worldbase fields', () => {
    const diff = compareWorldPack(
      snapshot(),
      { origin: 'same', tone: 'target tone', targetOnly: 'keep me', empty: 'already set' },
      [],
    )

    expect(diff.fields).toEqual([
      { field: 'origin', status: 'same', sourceValue: 'same', targetValue: 'same' },
      { field: 'tone', status: 'conflict', sourceValue: 'source tone', targetValue: 'target tone' },
      { field: 'era', status: 'add', sourceValue: 'ancient', targetValue: undefined },
    ])
    expect(diff.targetOnlyFields).toEqual([
      { field: 'targetOnly', targetValue: 'keep me' },
      { field: 'empty', targetValue: 'already set' },
    ])
    expect(diff.counts).toMatchObject({
      fieldsToAdd: 1,
      sameFields: 1,
      conflictingFields: 1,
      targetOnlyFields: 2,
    })
  })

  it('matches entities by category and name, never treats duplicate identities as safe additions', () => {
    const pack = snapshot([
      entity('source-new', 'New'),
      entity('source-same', 'Same'),
      entity('source-conflict', 'Conflict'),
      entity('source-ambiguous', 'Ambiguous'),
    ])
    const diff = compareWorldPack(pack, {}, [
      entity('target-same', 'same', { summary: 'Same summary' }),
      entity('target-conflict', 'Conflict', { summary: 'different summary' }),
      entity('target-ambiguous-1', 'Ambiguous'),
      entity('target-ambiguous-2', ' ambiguous '),
      entity('target-only', 'Target only'),
    ])

    expect(diff.entities.map(({ sourceEntity, status }) => [sourceEntity.name, status])).toEqual([
      ['New', 'add'],
      ['Same', 'same'],
      ['Conflict', 'conflict'],
      ['Ambiguous', 'ambiguous'],
    ])
    expect(diff.targetOnlyEntities.map(({ id }) => id)).toEqual(['target-only'])
    expect(diff.counts).toMatchObject({
      entitiesToAdd: 1,
      sameEntities: 1,
      conflictingEntities: 1,
      ambiguousEntities: 1,
      targetOnlyEntities: 1,
    })
  })

  it('compares structured field values independently of object key order', () => {
    expect(stableValue({ b: 2, a: { y: 1, x: 0 } })).toBe(stableValue({ a: { x: 0, y: 1 }, b: 2 }))
    expect(
      compareWorldPack(
        { ...snapshot(), worldbase: { rules: { b: 2, a: 1 } } },
        { rules: { a: 1, b: 2 } },
        [],
      ).fields[0]?.status,
    ).toBe('same')
  })
})
