import type { WorldPackSnapshot } from '../domain/worldPacks/worldPack'

export type NewWorldPackSnapshot = Omit<WorldPackSnapshot, 'version'>

/** Append-only persistence for globally reusable world-pack snapshots. */
export interface WorldPackSnapshotRepository {
  list(): Promise<WorldPackSnapshot[]>
  listBySourceProject(sourceProjectId: string): Promise<WorldPackSnapshot[]>
  get(id: string): Promise<WorldPackSnapshot | undefined>
  createVersion(snapshot: NewWorldPackSnapshot): Promise<WorldPackSnapshot>
}
