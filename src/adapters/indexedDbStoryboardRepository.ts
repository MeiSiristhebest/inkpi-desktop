import { db } from "../db/indexedDB"
import type {
  StoryboardSceneRecord,
  StoryboardRepository,
} from "../ports/storyboardRepository"

export const indexedDbStoryboardRepository: StoryboardRepository = {
  async getAll(projectId: string): Promise<StoryboardSceneRecord[]> {
    return db.getByIndex<StoryboardSceneRecord>("storyboardScenes", 'projectId', projectId)
  },

  async getByChapter(chapterId: string): Promise<StoryboardSceneRecord[]> {
    return db.getByIndex<StoryboardSceneRecord>("storyboardScenes", 'chapterId', chapterId)
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

