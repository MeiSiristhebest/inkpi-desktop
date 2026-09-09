export interface DomainChangedEvent {
  workspaceId: string
}

type DomainChangedListener = (event: DomainChangedEvent) => void

const listeners = new Set<DomainChangedListener>()

/** In-process signal emitted only after a local authoritative log append succeeds. */
export const domainChangeEvents = {
  publish(workspaceId: string): void {
    const event = { workspaceId }
    for (const listener of listeners) listener(event)
  },

  subscribe(workspaceId: string, listener: () => void): () => void {
    const wrapped = (event: DomainChangedEvent) => {
      if (event.workspaceId === workspaceId) listener()
    }
    listeners.add(wrapped)
    return () => listeners.delete(wrapped)
  },
}
