export interface DailyStatsChangedEvent {
  projectId: string
}

type DailyStatsChangedListener = (event: DailyStatsChangedEvent) => void

interface DailyStatsChannel {
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void
  postMessage(message: unknown): void
  unref?: () => void
}

const listeners = new Set<DailyStatsChangedListener>()
const CHANNEL_NAME = 'inkpi-daily-stats-changes'
let channel: DailyStatsChannel | undefined

export const dailyStatsEvents = {
  publish(projectId: string): void {
    if (!projectId.trim()) return
    const event = { projectId }
    notify(event)
    try {
      getChannel()?.postMessage(event)
    } catch {
      // A cross-context notification must not turn a successful write into a failure.
    }
  },

  subscribe(projectId: string, listener: () => void): () => void {
    const wrapped = (event: DailyStatsChangedEvent) => {
      if (event.projectId === projectId) listener()
    }
    listeners.add(wrapped)
    getChannel()
    return () => listeners.delete(wrapped)
  },
}

function notify(event: DailyStatsChangedEvent): void {
  for (const listener of listeners) listener(event)
}

function getChannel(): DailyStatsChannel | undefined {
  if (channel) return channel
  const Constructor = globalThis.BroadcastChannel
  if (typeof Constructor !== 'function') return undefined
  try {
    const next = new Constructor(CHANNEL_NAME)
    next.addEventListener('message', (event: MessageEvent<unknown>) => {
      const data = event.data
      if (
        !data ||
        typeof data !== 'object' ||
        typeof (data as { projectId?: unknown }).projectId !== 'string'
      )
        return
      const projectId = (data as { projectId: string }).projectId
      if (projectId.trim()) notify({ projectId })
    })
    ;(next as BroadcastChannel & { unref?: () => void }).unref?.()
    channel = next
    return channel
  } catch {
    return undefined
  }
}
