import { assertStoryState, type StoryState } from '../domain/story'
import { db } from '../db/indexedDB'
import type { StoryStateStore } from '../ports/storyStateStore'

interface StoryStateRecord {
  key: string
  value: StoryState
}

const STORY_STATE_KEY_PREFIX = 'storyState::'

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
    await db.put<StoryStateRecord>('settingsKV', {
      key: toKey(workspaceId),
      value: cloneStoryState(state),
    })
  }

  async remove(workspaceId: string): Promise<void> {
    await db.delete('settingsKV', toKey(workspaceId))
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
