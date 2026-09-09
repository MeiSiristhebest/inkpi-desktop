export interface DomainChangedEvent {
  workspaceId: string
}

type DomainChangedListener = (event: DomainChangedEvent) => void
interface DomainChangeChannel {
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void
  postMessage(message: unknown): void
  unref?: () => void
}

const listeners = new Set<DomainChangedListener>()
const CHANNEL_NAME = 'inkpi-authoritative-domain-changes'
let channel: DomainChangeChannel | undefined

/**
 * Signal emitted only after a local authoritative log append succeeds.
 *
 * BroadcastChannel is best-effort: IndexedDB remains the source of truth and
 * subscribers always reload from it. A remote Daemon pull deliberately does
 * not publish here, so a pull cannot create a sync loop.
 */
export const domainChangeEvents = {
  publish(workspaceId: string): void {
    const event = { workspaceId }
    notify(event)
    try {
      getChannel()?.postMessage(event)
    } catch {
      // Cross-context notification must not make an already successful local
      // authoritative append look like a failed write.
    }
  },

  subscribe(workspaceId: string, listener: () => void): () => void {
    const wrapped = (event: DomainChangedEvent) => {
      if (event.workspaceId === workspaceId) listener()
    }
    listeners.add(wrapped)
    return () => listeners.delete(wrapped)
  },
}

function notify(event: DomainChangedEvent): void {
  for (const listener of listeners) listener(event)
}

function getChannel(): DomainChangeChannel | undefined {
  if (channel) return channel
  const Constructor = globalThis.BroadcastChannel
  if (typeof Constructor !== 'function') return undefined
  try {
    const next = new Constructor(CHANNEL_NAME)
    next.addEventListener('message', (event: MessageEvent<unknown>) => {
      const data = event.data
      if (!data || typeof data !== 'object' || typeof (data as { workspaceId?: unknown }).workspaceId !== 'string') return
      const workspaceId = (data as { workspaceId: string }).workspaceId
      if (workspaceId.trim()) notify({ workspaceId })
    })
    ;(next as BroadcastChannel & { unref?: () => void }).unref?.()
    channel = next
    return channel
  } catch {
    return undefined
  }
}
