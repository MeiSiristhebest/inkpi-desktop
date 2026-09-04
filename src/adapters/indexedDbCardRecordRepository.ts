import { db } from '../db/indexedDB'
import type { CardRecord } from '../types'
import type { CardRecordRepository } from '../ports/cardRecordRepository'

export class IndexedDbCardRecordRepository implements CardRecordRepository {
  async getCards(projectId: string, tabId: string): Promise<CardRecord[]> {
    const all = await db.getAll<CardRecord>('cardRecords')
    return all.filter((c) => c.projectId === projectId && c.tabId === tabId)
  }

  async saveCard(card: CardRecord): Promise<void> {
    await db.put('cardRecords', card)
  }

  async deleteCard(id: string): Promise<void> {
    await db.delete('cardRecords', id)
  }
}

export const indexedDbCardRecordRepository = new IndexedDbCardRecordRepository()
export const defaultCardRecordRepository = indexedDbCardRecordRepository
