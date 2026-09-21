import { db } from '../db/indexedDB'
import type { ChapterBeatPlan } from '../plugins/scene-beats/types'
import type { SceneBeatRepository } from '../ports/sceneBeatRepository'
import {
  appendAuthoritativePluginDelete,
  appendAuthoritativePluginUpsert,
} from '../services/authoritativePluginWrite'

/**
 * IndexedDB 细纲节拍仓储适配器：把端口方法映射到 inkpi-studio 的 sceneBeats 表。
 */
export const indexedDbSceneBeatRepository: SceneBeatRepository = {
  getAll: () => db.getAll<ChapterBeatPlan>('sceneBeats'),
  getByChapter: async (chapterId: string) => {
    const all = await db.getAll<ChapterBeatPlan>('sceneBeats')
    return all.find((p) => p.chapterId === chapterId)
  },
  save: async (plan) => {
    const existing = await db.get<ChapterBeatPlan>('sceneBeats', plan.id)
    await appendAuthoritativePluginUpsert({
      aggregateType: 'scene-beat-plan',
      aggregateId: plan.id,
      workspaceId: plan.projectId,
      store: 'sceneBeats',
      record: plan,
      existing,
    })
  },
  delete: async (id) => {
    const existing = await db.get<ChapterBeatPlan>('sceneBeats', id)
    await appendAuthoritativePluginDelete({
      aggregateType: 'scene-beat-plan',
      aggregateId: id,
      store: 'sceneBeats',
      existing,
    })
  },
}
