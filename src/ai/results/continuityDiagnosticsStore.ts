import type { ContinuityDiagnosticMarker } from './continuityDiagnostics'

type Listener = () => void

const records = new Map<string, readonly ContinuityDiagnosticMarker[]>()
const listeners = new Map<string, Set<Listener>>()

export const continuityDiagnosticsStore = {
  get(projectId: string, chapterId: string): readonly ContinuityDiagnosticMarker[] {
    return records.get(toKey(projectId, chapterId)) ?? []
  },

  set(projectId: string, chapterId: string, markers: readonly ContinuityDiagnosticMarker[]): void {
    const key = toKey(projectId, chapterId)
    records.set(key, markers.map(cloneMarker))
    notify(key)
  },

  clear(projectId: string, chapterId: string): void {
    const key = toKey(projectId, chapterId)
    if (!records.delete(key)) return
    notify(key)
  },

  subscribe(projectId: string, chapterId: string, listener: Listener): () => void {
    const key = toKey(projectId, chapterId)
    const subscribers = listeners.get(key) ?? new Set<Listener>()
    subscribers.add(listener)
    listeners.set(key, subscribers)
    return () => {
      subscribers.delete(listener)
      if (subscribers.size === 0) listeners.delete(key)
    }
  },
}

function toKey(projectId: string, chapterId: string): string {
  return `${projectId}\u0000${chapterId}`
}

function notify(key: string): void {
  for (const listener of listeners.get(key) ?? []) listener()
}

function cloneMarker(marker: ContinuityDiagnosticMarker): ContinuityDiagnosticMarker {
  return {
    ...marker,
    ...(marker.entityIds ? { entityIds: [...marker.entityIds] } : {}),
    ...(marker.blockIds ? { blockIds: [...marker.blockIds] } : {}),
    unresolvedBlockIds: [...marker.unresolvedBlockIds],
    locations: marker.locations.map((location) => ({ ...location })),
  }
}
