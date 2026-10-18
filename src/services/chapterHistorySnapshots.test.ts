import { describe, expect, it } from 'vitest'
import type { KeyValueStore } from '../ports/keyValueStore'
import {
  updateChapterHistorySnapshots,
  type ChapterHistorySnapshot,
} from './chapterHistorySnapshots'

describe('updateChapterHistorySnapshots', () => {
  it('keeps concurrent automatic and milestone updates in the same chapter history', async () => {
    const data = new Map<string, string>()
    const store: KeyValueStore = {
      get: async (key) => {
        await Promise.resolve()
        return data.get(key) ?? null
      },
      set: async (key, value) => {
        await Promise.resolve()
        data.set(key, value)
      },
    }
    const key = 'project::chapter-history::chapter'
    const auto: ChapterHistorySnapshot = {
      id: 'auto-1',
      timestamp: 1,
      wordCount: 1,
      content: 'auto',
      kind: 'auto',
    }
    const milestone: ChapterHistorySnapshot = {
      id: 'milestone-1',
      timestamp: 2,
      wordCount: 2,
      content: 'milestone',
      kind: 'milestone',
    }

    await Promise.all([
      updateChapterHistorySnapshots<ChapterHistorySnapshot>(store, key, (current) => [
        auto,
        ...current,
      ]),
      updateChapterHistorySnapshots<ChapterHistorySnapshot>(store, key, (current) => [
        milestone,
        ...current,
      ]),
    ])

    const persisted = JSON.parse(data.get(key) || '[]') as ChapterHistorySnapshot[]
    expect(persisted.map((snapshot) => snapshot.id)).toEqual(['milestone-1', 'auto-1'])
  })
})
