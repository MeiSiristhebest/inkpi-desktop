import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/indexedDB'
import {
  chapterHistoryStorageKey,
  indexedDbChapterHistoryStore,
} from './indexedDbChapterHistoryStore'
import { updateChapterHistorySnapshots } from '../services/chapterHistorySnapshots'

const legacyKey = 'chapter-history-ch-1'
const firstKey = chapterHistoryStorageKey('project-a', 'ch-1')
const secondKey = chapterHistoryStorageKey('project-b', 'ch-1')
const concurrentKey = chapterHistoryStorageKey('project-c', 'ch-1')

beforeEach(async () => {
  await Promise.all([
    db.delete('settingsKV', firstKey),
    db.delete('settingsKV', secondKey),
    db.delete('settingsKV', concurrentKey),
  ])
  localStorage.removeItem(legacyKey)
})

describe('IndexedDB chapter history store', () => {
  it('migrates a legacy localStorage snapshot once and removes the old key', async () => {
    const snapshot = JSON.stringify([{ id: 'milestone-1', content: '<p>定稿</p>' }])
    localStorage.setItem(legacyKey, snapshot)

    await expect(indexedDbChapterHistoryStore.get(firstKey)).resolves.toBe(snapshot)
    expect(localStorage.getItem(legacyKey)).toBeNull()
    await expect(db.get('settingsKV', firstKey)).resolves.toEqual({
      key: firstKey,
      value: snapshot,
    })
  })

  it('stores same chapter ids independently by workspace', async () => {
    const first = JSON.stringify([{ id: 'snapshot-a', content: 'A' }])
    const second = JSON.stringify([{ id: 'snapshot-b', content: 'B' }])

    await indexedDbChapterHistoryStore.set(firstKey, first)
    await indexedDbChapterHistoryStore.set(secondKey, second)

    await expect(indexedDbChapterHistoryStore.get(firstKey)).resolves.toBe(first)
    await expect(indexedDbChapterHistoryStore.get(secondKey)).resolves.toBe(second)
  })

  it('merges concurrent updates from separate store instances in one IndexedDB transaction each', async () => {
    const storeA = { ...indexedDbChapterHistoryStore }
    const storeB = { ...indexedDbChapterHistoryStore }
    const automatic = { id: 'auto-1', content: '自动保存', kind: 'auto' as const }
    const milestone = { id: 'milestone-1', content: '里程碑', kind: 'milestone' as const }

    await Promise.all([
      updateChapterHistorySnapshots(storeA, concurrentKey, (current) => [automatic, ...current]),
      updateChapterHistorySnapshots(storeB, concurrentKey, (current) => [milestone, ...current]),
    ])

    const persisted = JSON.parse((await indexedDbChapterHistoryStore.get(concurrentKey)) || '[]')
    expect(persisted.map((snapshot: { id: string }) => snapshot.id)).toEqual([
      'milestone-1',
      'auto-1',
    ])
  })
})
