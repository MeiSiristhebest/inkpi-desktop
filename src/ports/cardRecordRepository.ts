import type { CardRecord } from '../types'

/**
 * 设定卡片仓储端口 (DIP)
 */
export interface CardRecordRepository {
  getCards(projectId: string, tabId: string): Promise<CardRecord[]>
  saveCard(card: CardRecord): Promise<void>
  deleteCard(id: string): Promise<void>
}
