import type { RoleplaySession } from '../domain/roleplay/roleplaySession'

/** Durable project-scoped storage for non-canonical roleplay sessions. */
export interface RoleplaySessionRepository {
  listByProject(projectId: string): Promise<RoleplaySession[]>
  get(id: string): Promise<RoleplaySession | undefined>
  save(session: RoleplaySession): Promise<void>
  delete(id: string): Promise<void>
}
