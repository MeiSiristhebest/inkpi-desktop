export interface StoryStateChangedEvent {
  workspaceId: string
  revision: number
}

type StoryStateChangedListener = (event: StoryStateChangedEvent) => void

const listeners = new Set<StoryStateChangedListener>()

/**
 * 独立的 StoryState 物化变更通知端口（P1-A 版本轴解耦）
 * 避免将物化产生的 StoryState revision 伪装成 Workspace authoritative domain revision。
 */
export const storyStateEvents = {
  publish(workspaceId: string, revision: number): void {
    const event: StoryStateChangedEvent = { workspaceId, revision }
    for (const listener of listeners) {
      try {
        listener(event)
      } catch {
        // Safe isolation
      }
    }
  },

  subscribe(
    workspaceId: string,
    listener: (event: StoryStateChangedEvent) => void,
  ): () => void {
    const wrapped = (event: StoryStateChangedEvent) => {
      if (event.workspaceId === workspaceId) listener(event)
    }
    listeners.add(wrapped)
    return () => listeners.delete(wrapped)
  },
}
