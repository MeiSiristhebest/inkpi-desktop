import { db } from '../db/indexedDB'
import type {
  NarrativeArchetypeRecord,
  ArchetypeCategory,
  ArchetypeRepository,
} from '../ports/archetypeRepository'

export const indexedDbArchetypeRepository: ArchetypeRepository = {
  async getAll(): Promise<NarrativeArchetypeRecord[]> {
    return await db.getAll<NarrativeArchetypeRecord>('narrativeArchetypes')
  },

  async getByCategory(category: ArchetypeCategory): Promise<NarrativeArchetypeRecord[]> {
    return await db.getByIndex<NarrativeArchetypeRecord>(
      'narrativeArchetypes',
      'category',
      category,
    )
  },

  async get(id: string): Promise<NarrativeArchetypeRecord | undefined> {
    return await db.get<NarrativeArchetypeRecord>('narrativeArchetypes', id)
  },

  async save(record: NarrativeArchetypeRecord): Promise<void> {
    await db.put('narrativeArchetypes', record)
  },
}
