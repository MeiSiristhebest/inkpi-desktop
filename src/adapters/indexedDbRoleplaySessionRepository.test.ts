import { afterEach, describe, expect, it } from 'vitest'
import type { RoleplaySession } from '../domain/roleplay/roleplaySession'
import { db } from '../db/indexedDB'
import { indexedDbRoleplaySessionRepository } from './indexedDbRoleplaySessionRepository'

function session(id: string, projectId: string): RoleplaySession {
  return {
    id,
    schemaVersion: 1,
    projectId,
    title: id,
    scenario: 'A sealed city',
    playerCharacter: 'A traveler',
    aiCharacter: 'The guide',
    stateNotes: '',
    messages: [{ id: `${id}-message`, role: 'user', text: 'Hello', createdAt: 1 }],
    turnStatus: 'ready',
    revision: 0,
    createdAt: 1,
    updatedAt: 1,
  }
}

const ids = ['roleplay-repository-a', 'roleplay-repository-b'] as const

afterEach(async () => {
  await Promise.all(ids.map((id) => db.delete('roleplaySessions', id)))
})

describe('indexedDbRoleplaySessionRepository', () => {
  it('uses project-scoped reads and returns detached message data', async () => {
    const first = session(ids[0], 'roleplay-project-a')
    const other = session(ids[1], 'roleplay-project-b')
    await Promise.all([
      indexedDbRoleplaySessionRepository.save(first),
      indexedDbRoleplaySessionRepository.save(other),
    ])

    const loaded = await indexedDbRoleplaySessionRepository.listByProject(first.projectId)
    expect(loaded).toEqual([first])
    const loadedSession = loaded[0]!
    loadedSession.messages[0]!.text = 'mutated outside the repository'
    expect(await indexedDbRoleplaySessionRepository.get(first.id)).toEqual(first)
  })
})
