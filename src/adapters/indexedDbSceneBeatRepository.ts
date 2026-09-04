import { db } from '../db/indexedDB'
import type { ChapterBeatPlan } from '../plugins/scene-beats/types'
import type { SceneBeatRepository } from '../ports/sceneBeatRepository'

/**
 * IndexedDB 细纲节拍仓储适配器：把端口方法映射到 inkpi-studio 的 sceneBeats 表。
 */
export const indexedDbSceneBeatRepository: SceneBeatRepository = {
  getAll: () => db.getAll<ChapterBeatPlan>('sceneBeats'),
  getByChapter: async (chapterId: string) => {
    const all = await db.getAll<ChapterBeatPlan>('sceneBeats')
    return all.find((p) => p.chapterId === chapterId)
  },
  save: (plan) => db.put('sceneBeats', plan),
  delete: (id) => db.delete('sceneBeats', id),
}
