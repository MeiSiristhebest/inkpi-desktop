import { db } from "../db/indexedDB"
import type {
  RhythmRadarReportRecord,
  RhythmRadarRepository,
} from "../ports/rhythmRadarRepository"

export const indexedDbRhythmRadarRepository: RhythmRadarRepository = {
  async getAll(projectId: string): Promise<RhythmRadarReportRecord[]> {
    const all = await db.getAll<RhythmRadarReportRecord>("rhythmRadarReports")
    return all.filter((r) => r.projectId === projectId)
  },

  async getByChapter(chapterId: string): Promise<RhythmRadarReportRecord | undefined> {
    const all = await db.getAll<RhythmRadarReportRecord>("rhythmRadarReports")
    return all.find((r) => r.chapterId === chapterId)
  },

  async get(id: string): Promise<RhythmRadarReportRecord | undefined> {
    return await db.get<RhythmRadarReportRecord>("rhythmRadarReports", id)
  },

  async save(record: RhythmRadarReportRecord): Promise<void> {
    await db.put("rhythmRadarReports", record)
  },

  async delete(id: string): Promise<void> {
    await db.delete("rhythmRadarReports", id)
  },
}
