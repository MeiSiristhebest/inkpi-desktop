import { db } from "../db/indexedDB"
import type {
  StoryboardSceneRecord,
  StoryboardRepository,
} from "../ports/storyboardRepository"

export const indexedDbStoryboardRepository: StoryboardRepository = {
  async getAll(projectId: string): Promise<StoryboardSceneRecord[]> {
    const all = await db.getAll<StoryboardSceneRecord>("storyboardScenes")
    return all.filter((r) => r.projectId === projectId)
  },

  async getByChapter(chapterId: string): Promise<StoryboardSceneRecord[]> {
    const all = await db.getAll<StoryboardSceneRecord>("storyboardScenes")
    return all.filter((r) => r.chapterId === chapterId)
  },

  async get(id: string): Promise<StoryboardSceneRecord | undefined> {
    return await db.get<StoryboardSceneRecord>("storyboardScenes", id)
  },

  async save(record: StoryboardSceneRecord): Promise<void> {
    await db.put("storyboardScenes", record)
  },

  async delete(id: string): Promise<void> {
    await db.delete("storyboardScenes", id)
  },
}

