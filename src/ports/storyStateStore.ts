import type { StoryState } from '../domain/story'

/** Authoritative local StoryState persistence boundary. */
export interface StoryStateStore {
  load(workspaceId: string): Promise<StoryState | undefined>
  save(workspaceId: string, state: StoryState): Promise<void>
  remove(workspaceId: string): Promise<void>
}
