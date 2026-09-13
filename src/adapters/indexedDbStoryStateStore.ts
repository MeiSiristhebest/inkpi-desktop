import {
  assertStoryState,
  deserializeStoryState,
  serializeStoryState,
  type StoryState,
} from '../domain/story'
import { db } from '../db/indexedDB'
import type { StoryStateStore } from '../ports/storyStateStore'
import { appendIndexedDbDomainChange } from './indexedDbDomainChangeAppender'

interface StoryStateRecord {
  key: string
  /** Stored as deterministic JSON; older object records are migrated on read. */
  value: StoryState | string
}

const STORY_STATE_KEY_PREFIX = 'storyState::'
let storyStateWriteQueue: Promise<void> = Promise.resolve()

/** Stores the desktop-authoritative StoryState in IndexedDB for offline use. */
export class IndexedDbStoryStateStore implements StoryStateStore {
  async load(workspaceId: string): Promise<StoryState | undefined> {
    const record = await db.get<StoryStateRecord>('settingsKV', toKey(workspaceId))
    if (!record) return undefined
    return cloneStoryState(decodeStoredState(record.value))
  }

  async save(workspaceId: string, state: StoryState): Promise<void> {
    assertWorkspaceId(workspaceId)
    assertStoryState(state)
    return enqueueStoryStateWrite(async () => {
      const existing = await db.get<StoryStateRecord>('settingsKV', toKey(workspaceId))
      const serialized = serializeStoryState(state)
      if (existing) {
        const existingState = decodeStoredState(existing.value)
        const existingSerialized = serializeStoryState(existingState)
        if (existingSerialized === serialized) return
        if (state.revision <= existingState.revision) {
          throw new Error(
            `Story state revision conflict: expected a revision after ${existingState.revision}, received ${state.revision}`,
          )
        }
      }
      const occurredAt = Date.now()
      await appendIndexedDbDomainChange({
        aggregateType: 'story-state',
        aggregateId: workspaceId,
        workspaceId,
        operation: 'upsert',
        payload: deserializeStoryState(serialized),
        occurredAt,
        aggregateRevision: state.revision,
      })
      await db.put<StoryStateRecord>('settingsKV', {
        key: toKey(workspaceId),
        value: serialized,
      })
    })
  }

  async remove(workspaceId: string): Promise<void> {
    assertWorkspaceId(workspaceId)
    return enqueueStoryStateWrite(async () => {
      const existing = await db.get<StoryStateRecord>('settingsKV', toKey(workspaceId))
      if (!existing) return
      const existingState = decodeStoredState(existing.value)
      const occurredAt = Date.now()
      await appendIndexedDbDomainChange({
        aggregateType: 'story-state',
        aggregateId: workspaceId,
        workspaceId,
        operation: 'delete',
        payload: undefined,
        occurredAt,
        aggregateRevision: existingState.revision + 1,
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

function decodeStoredState(value: unknown): StoryState {
  try {
    if (typeof value === 'string') return deserializeStoryState(value)
    assertStoryState(value as StoryState)
    return deserializeStoryState(serializeStoryState(value as StoryState))
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
