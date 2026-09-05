import { db } from '../db/indexedDB'
import type {
  SubPlotStrandRecord,
  SubPlotRepository,
} from '../ports/subPlotRepository'

export const indexedDbSubPlotRepository: SubPlotRepository = {
  async getAll(projectId: string): Promise<SubPlotStrandRecord[]> {
    return db.getByIndex<SubPlotStrandRecord>('subPlotStrands', 'projectId', projectId)
  },

  async get(id: string): Promise<SubPlotStrandRecord | undefined> {
    return await db.get<SubPlotStrandRecord>('subPlotStrands', id)
  },

  async save(record: SubPlotStrandRecord): Promise<void> {
    await db.put('subPlotStrands', record)
  },

  async delete(id: string): Promise<void> {
    await db.delete('subPlotStrands', id)
  },
}
