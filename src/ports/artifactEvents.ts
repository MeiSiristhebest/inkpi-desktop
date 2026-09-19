export interface ArtifactEvent {
  artifactId: string
  workspaceId?: string
  action: 'created' | 'updated' | 'deleted'
}

type ArtifactListener = (event: ArtifactEvent) => void

class ArtifactEventBus {
  private readonly listeners = new Set<ArtifactListener>()
  private readonly channel: BroadcastChannel | null = null

  constructor() {
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel('inkpi-artifact-events')
        this.channel.onmessage = (e: MessageEvent<ArtifactEvent>) => {
          if (e.data && typeof e.data.artifactId === 'string') {
            this.notifyLocal(e.data)
          }
        }
      } catch {
        this.channel = null
      }
    }
  }

  publish(event: ArtifactEvent): void {
    this.notifyLocal(event)
    try {
      this.channel?.postMessage(event)
    } catch {
      // ignore serialization errors
    }
  }

  subscribe(
    workspaceIdOrListener: string | ArtifactListener,
    maybeListener?: ArtifactListener,
  ): () => void {
    let targetWorkspaceId: string | undefined
    let listener: ArtifactListener

    if (typeof workspaceIdOrListener === 'string') {
      targetWorkspaceId = workspaceIdOrListener
      listener = maybeListener!
    } else {
      listener = workspaceIdOrListener
    }

    const handler: ArtifactListener = (event) => {
      if (!targetWorkspaceId || event.workspaceId === targetWorkspaceId) {
        listener(event)
      }
    }

    this.listeners.add(handler)
    return () => {
      this.listeners.delete(handler)
    }
  }

  private notifyLocal(event: ArtifactEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch (err) {
        console.error('[ArtifactEvents] Listener error:', err)
      }
    }
  }
}

export const artifactEvents = new ArtifactEventBus()
