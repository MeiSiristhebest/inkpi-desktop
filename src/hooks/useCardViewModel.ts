import { useState, useEffect, useCallback } from 'react'
import type { CardRecord } from '../types'
import type { CardRecordRepository } from '../ports/cardRecordRepository'
import type { IdGenerator } from '../ports/idGenerator'
import type { Clock } from '../ports/clock'
import { indexedDbCardRecordRepository } from '../adapters/indexedDbCardRecordRepository'
import { idGenerator } from '../adapters/idGenerator'
import { clock } from '../adapters/clock'

export interface UseCardViewModelOptions {
  projectId: string
  tabId: string
  repository?: CardRecordRepository
  idGen?: IdGenerator
  clockPort?: Clock
}

export function useCardViewModel({
  projectId,
  tabId,
  repository = indexedDbCardRecordRepository,
  idGen = idGenerator,
  clockPort = clock,
}: UseCardViewModelOptions) {
  const [cards, setCards] = useState<CardRecord[]>([])
  const [editingCard, setEditingCard] = useState<CardRecord | null>(null)
  const [isNewCard, setIsNewCard] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)

  const loadCards = useCallback(async () => {
    setLoading(true)
    try {
      const data = await repository.getCards(projectId, tabId)
      setCards(data)
    } finally {
      setLoading(false)
    }
  }, [projectId, tabId, repository])

  useEffect(() => {
    loadCards()
  }, [loadCards])

  const createCard = useCallback(() => {
    const newRecord: CardRecord = {
      id: idGen.generate('card'),
      projectId,
      tabId,
      name: '',
      order: cards.length,
      data: {},
      createdAt: clockPort.now(),
      updatedAt: clockPort.now(),
    }
    setIsNewCard(true)
    setEditingCard(newRecord)
    return newRecord
  }, [cards.length, projectId, tabId, idGen, clockPort])

  const saveEditing = useCallback(async () => {
    if (!editingCard) return
    const finalName = editingCard.name.trim() || '未命名卡片'
    const record: CardRecord = {
      ...editingCard,
      name: finalName,
      updatedAt: clockPort.now(),
    }
    await repository.saveCard(record)
    setEditingCard(null)
    setIsNewCard(false)
    await loadCards()
  }, [editingCard, repository, loadCards, clockPort])

  const deleteCard = useCallback(
    async (id: string) => {
      await repository.deleteCard(id)
      if (editingCard?.id === id) {
        setEditingCard(null)
        setIsNewCard(false)
      }
      await loadCards()
    },
    [editingCard, repository, loadCards],
  )

  const cancelEditing = useCallback(() => {
    setEditingCard(null)
    setIsNewCard(false)
  }, [])

  return {
    cards,
    loading,
    editingCard,
    isNewCard,
    setEditingCard,
    createCard,
    saveEditing,
    deleteCard,
    cancelEditing,
    reload: loadCards,
  }
}
