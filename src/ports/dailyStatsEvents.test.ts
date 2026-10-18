import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { dailyStatsEvents } from './dailyStatsEvents'

class FakeBroadcastChannel {
  static instances: FakeBroadcastChannel[] = []
  readonly messages: unknown[] = []
  private readonly listeners = new Set<(event: { data: unknown }) => void>()

  constructor(readonly name: string) {
    FakeBroadcastChannel.instances.push(this)
  }

  addEventListener(_type: 'message', listener: (event: { data: unknown }) => void): void {
    this.listeners.add(listener)
  }

  postMessage(message: unknown): void {
    this.messages.push(message)
  }

  unref(): void {}

  emit(data: unknown): void {
    for (const listener of this.listeners) listener({ data })
  }
}

beforeEach(() => {
  vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel)
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('daily stats events', () => {
  it('notifies matching local subscribers and broadcasts committed changes', () => {
    const projectListener = vi.fn()
    const otherListener = vi.fn()
    const unsubscribeProject = dailyStatsEvents.subscribe('project-1', projectListener)
    const unsubscribeOther = dailyStatsEvents.subscribe('project-2', otherListener)
    const channel = FakeBroadcastChannel.instances[0]

    dailyStatsEvents.publish('project-1')

    expect(projectListener).toHaveBeenCalledOnce()
    expect(otherListener).not.toHaveBeenCalled()
    expect(channel?.name).toBe('inkpi-daily-stats-changes')
    expect(channel?.messages).toEqual([{ projectId: 'project-1' }])

    unsubscribeProject()
    unsubscribeOther()
  })

  it('receives valid changes from another window and ignores malformed events', () => {
    const listener = vi.fn()
    const unsubscribe = dailyStatsEvents.subscribe('project-3', listener)
    const channel = FakeBroadcastChannel.instances[0]

    channel?.emit({ projectId: 'project-3' })
    channel?.emit({ projectId: '' })
    channel?.emit({ workspaceId: 'project-3' })

    expect(listener).toHaveBeenCalledOnce()
    unsubscribe()
  })
})
