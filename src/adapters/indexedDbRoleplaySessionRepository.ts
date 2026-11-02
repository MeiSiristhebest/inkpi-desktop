import { db } from '../db/indexedDB'
import { cloneRoleplaySession, type RoleplaySession } from '../domain/roleplay/roleplaySession'
import type { RoleplaySessionRepository } from '../ports/roleplaySessionRepository'

export const indexedDbRoleplaySessionRepository: RoleplaySessionRepository = {
  listByProject: async (projectId) => {
    const sessions = await db.getByIndex<RoleplaySession>(
      'roleplaySessions',
      'projectId',
      projectId,
    )
    return sessions.map(cloneRoleplaySession)
  },
  get: async (id) => {
    const session = await db.get<RoleplaySession>('roleplaySessions', id)
    return session ? cloneRoleplaySession(session) : undefined
  },
  save: (session) => db.put('roleplaySessions', cloneRoleplaySession(session)),
  delete: (id) => db.delete('roleplaySessions', id),
}
