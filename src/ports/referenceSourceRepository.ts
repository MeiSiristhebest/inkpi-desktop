import type { ReferenceSourceRecord } from '../domain/references/referenceMaterials'

export interface ReferenceSourceRepository {
  getAll(): Promise<ReferenceSourceRecord[]>
  getById(id: string): Promise<ReferenceSourceRecord | undefined>
  save(source: ReferenceSourceRecord): Promise<void>
  delete(id: string): Promise<void>
}
