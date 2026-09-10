import { assertStoryState, type StoryState } from '../domain/story'
import { db } from '../db/indexedDB'
import type { StoryStateStore } from '../ports/storyStateStore'
import { appendIndexedDbDomainChange } from './indexedDbDomainChangeAppender'

interface StoryStateRecord {
  key: string
  value: StoryState
}

const STORY_STATE_KEY_PREFIX = 'storyState::'
let storyStateWriteQueue: Promise<void> = Promise.resolve()

/** Stores the desktop-authoritative StoryState in IndexedDB for offline use. */
export class IndexedDbStoryStateStore implements StoryStateStore {
  async load(workspaceId: string): Promise<StoryState | undefined> {
    const record = await db.get<StoryStateRecord>('settingsKV', toKey(workspaceId))
    if (!record) return undefined
    assertStoredState(record.value)
    return cloneStoryState(record.value)
  }

  async save(workspaceId: string, state: StoryState): Promise<void> {
    assertWorkspaceId(workspaceId)
    assertStoryState(state)
    return enqueueStoryStateWrite(async () => {
      const existing = await db.get<StoryStateRecord>('settingsKV', toKey(workspaceId))
      if (existing) {
        assertStoredState(existing.value)
        const existingSerialized = JSON.stringify(existing.value)
        const nextSerialized = JSON.stringify(state)
        if (existingSerialized === nextSerialized) return
        if (state.revision <= existing.value.revision) {
          throw new Error(
            `Story state revision conflict: expected a revision after ${existing.value.revision}, received ${state.revision}`,
          )
        }
      }
      const occurredAt = Date.now()
      await appendIndexedDbDomainChange({
        aggregateType: 'story-state',
        aggregateId: workspaceId,
        workspaceId,
        operation: 'upsert',
        payload: cloneStoryState(state),
        occurredAt,
        aggregateRevision: state.revision,
      })
      await db.put<StoryStateRecord>('settingsKV', {
        key: toKey(workspaceId),
        value: cloneStoryState(state),
      })
    })
  }

  async remove(workspaceId: string): Promise<void> {
    assertWorkspaceId(workspaceId)
    return enqueueStoryStateWrite(async () => {
      const existing = await db.get<StoryStateRecord>('settingsKV', toKey(workspaceId))
      if (!existing) return
      assertStoredState(existing.value)
      const occurredAt = Date.now()
      await appendIndexedDbDomainChange({
        aggregateType: 'story-state',
        aggregateId: workspaceId,
        workspaceId,
        operation: 'delete',
        payload: undefined,
        occurredAt,
        aggregateRevision: existing.value.revision + 1,
      })
      await db.delete('settingsKV', toKey(workspaceId))
    })
  }
}

export const indexedDbStoryStateStore = new IndexedDbStoryStateStore()

function toKey(workspaceId: string): string {
  assertWorkspaceId(workspaceId)
  return `${STORY_STATE_KEY_PREFIX}${encodeURIComponent(workspaceId)}`
}

function assertWorkspaceId(workspaceId: string): void {
  if (typeof workspaceId !== 'string' || !workspaceId.trim()) {
    throw new Error('Story state workspace id must not be empty')
  }
}

function assertStoredState(value: unknown): asserts value is StoryState {
  if (!value || typeof value !== 'object') {
    throw new Error('Stored StoryState is corrupt')
  }
  try {
    assertStoryState(value as StoryState)
  } catch (error) {
    throw new Error('Stored StoryState is corrupt', { cause: error })
  }
}

function cloneStoryState(state: StoryState): StoryState {
  return structuredClone(state)
}

function enqueueStoryStateWrite(operation: () => Promise<void>): Promise<void> {
  const queued = storyStateWriteQueue.then(operation)
  storyStateWriteQueue = queued.catch(() => undefined)
  return queued
}
