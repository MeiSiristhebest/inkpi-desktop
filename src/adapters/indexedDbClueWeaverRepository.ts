import { db } from '../db/indexedDB'
import type {
  ClueItem,
  ClueCognitionRecord,
  ClueWeaverRepository,
} from '../ports/clueWeaverRepository'

interface StoredRecord {
  id: string
  projectId: string
  recordType: 'clue' | 'cognition'
  payload: ClueItem | ClueCognitionRecord
}

export const indexedDbClueWeaverRepository: ClueWeaverRepository = {
  async getAllClues(projectId: string): Promise<ClueItem[]> {
    const all = await db.getAll<StoredRecord>('clueMatrices')
    return all
      .filter((r) => r.projectId === projectId && r.recordType === 'clue')
      .map((r) => r.payload as ClueItem)
  },

  async saveClue(clue: ClueItem): Promise<void> {
    const record: StoredRecord = {
      id: clue.id,
      projectId: clue.projectId,
      recordType: 'clue',
      payload: clue,
    }
    await db.put('clueMatrices', record)
  },

  async deleteClue(id: string): Promise<void> {
    await db.delete('clueMatrices', id)
  },

  async getAllCognitions(projectId: string): Promise<ClueCognitionRecord[]> {
    const all = await db.getAll<StoredRecord>('clueMatrices')
    return all
      .filter((r) => r.projectId === projectId && r.recordType === 'cognition')
      .map((r) => r.payload as ClueCognitionRecord)
  },

  async saveCognition(record: ClueCognitionRecord): Promise<void> {
    const stored: StoredRecord = {
      id: record.id,
      projectId: record.projectId,
      recordType: 'cognition',
      payload: record,
    }
    await db.put('clueMatrices', stored)
  },

  async deleteCognition(id: string): Promise<void> {
    await db.delete('clueMatrices', id)
  },
}
