import { db } from '../db/indexedDB'
import type { ReferenceSourceRepository } from '../ports/referenceSourceRepository'
import type { ReferenceSourceRecord } from '../domain/references/referenceMaterials'

/** Global, local-only reference source records; project access remains a separate settingsKV link. */
export const indexedDbReferenceSourceRepository: ReferenceSourceRepository = {
  getAll: () => db.getAll<ReferenceSourceRecord>('referenceSources'),
  getById: (id) => db.get<ReferenceSourceRecord>('referenceSources', id),
  save: (source) => db.put('referenceSources', source),
  delete: (id) => db.delete('referenceSources', id),
}
