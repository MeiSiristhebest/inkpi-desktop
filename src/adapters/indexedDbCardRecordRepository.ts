import { db } from '../db/indexedDB'
import type { CardRecord } from '../types'
import type { CardRecordRepository } from '../ports/cardRecordRepository'
import {
  appendAuthoritativePluginDelete,
  appendAuthoritativePluginUpsert,
} from '../services/authoritativePluginWrite'

export class IndexedDbCardRecordRepository implements CardRecordRepository {
  async getCards(projectId: string, tabId: string): Promise<CardRecord[]> {
    const cards = await db.getByIndex<CardRecord>('cardRecords', 'projectId', projectId)
    return cards.filter((card) => card.tabId === tabId)
  }

  async saveCard(card: CardRecord): Promise<void> {
    const existing = await db.get<CardRecord>('cardRecords', card.id)
    await appendAuthoritativePluginUpsert({
      aggregateType: 'card',
      aggregateId: card.id,
      workspaceId: card.projectId,
      store: 'cardRecords',
      record: card,
      existing,
    })
  }

  async deleteCard(id: string): Promise<void> {
    const existing = await db.get<CardRecord>('cardRecords', id)
    await appendAuthoritativePluginDelete({
      aggregateType: 'card',
      aggregateId: id,
      store: 'cardRecords',
      existing,
    })
  }
}

export const indexedDbCardRecordRepository = new IndexedDbCardRecordRepository()
export const defaultCardRecordRepository = indexedDbCardRecordRepository
