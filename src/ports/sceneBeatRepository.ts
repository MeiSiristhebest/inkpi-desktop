import type { ChapterBeatPlan } from '../plugins/scene-beats/types'

/**
 * 细纲节拍仓储端口（抽象）。
 */
export interface SceneBeatRepository {
  getAll(): Promise<ChapterBeatPlan[]>
  getByChapter(chapterId: string): Promise<ChapterBeatPlan | undefined>
  save(plan: ChapterBeatPlan): Promise<void>
  delete(id: string): Promise<void>
}
