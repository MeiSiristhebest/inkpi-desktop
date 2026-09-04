import { db } from '../db/indexedDB'
import type {
  CharacterVoiceprint,
  DialogueVoiceprintRepository,
} from '../ports/dialogueVoiceprintRepository'

export const indexedDbDialogueVoiceprintRepository: DialogueVoiceprintRepository = {
  async getAll(projectId: string): Promise<CharacterVoiceprint[]> {
    const all = await db.getAll<CharacterVoiceprint>('dialogueVoiceprints')
    return all.filter((r) => r.projectId === projectId)
  },

  async getByName(projectId: string, name: string): Promise<CharacterVoiceprint | undefined> {
    const all = await this.getAll(projectId)
    return all.find((r) => r.characterName === name)
  },

  async save(record: CharacterVoiceprint): Promise<void> {
    await db.put('dialogueVoiceprints', record)
  },

  async delete(id: string): Promise<void> {
    await db.delete('dialogueVoiceprints', id)
  },
}
