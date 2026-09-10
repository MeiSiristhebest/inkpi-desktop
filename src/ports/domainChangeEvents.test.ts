import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { domainChangeEvents } from './domainChangeEvents'

class FakeBroadcastChannel {
  static instances: FakeBroadcastChannel[] = []
  private readonly listeners = new Set<(event: { data: unknown }) => void>()

  constructor(_name: string) {
    FakeBroadcastChannel.instances.push(this)
  }

  addEventListener(_type: 'message', listener: (event: { data: unknown }) => void): void {
    this.listeners.add(listener)
  }

  postMessage(_message: unknown): void {}

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

describe('domain change events', () => {
  it('notifies only listeners for the changed workspace', () => {
    const projectListener = vi.fn()
    const otherListener = vi.fn()
    const unsubscribeProject = domainChangeEvents.subscribe('project-1', projectListener)
    const unsubscribeOther = domainChangeEvents.subscribe('project-2', otherListener)

    domainChangeEvents.publish('project-1')
    expect(projectListener).toHaveBeenCalledOnce()
    expect(otherListener).not.toHaveBeenCalled()

    unsubscribeProject()
    unsubscribeOther()
  })

  it('forwards a valid external workspace event to matching listeners', () => {
    const listener = vi.fn()
    const unsubscribe = domainChangeEvents.subscribe('project-3', listener)

    domainChangeEvents.publish('project-3')
    FakeBroadcastChannel.instances[0]?.emit({ workspaceId: 'project-3' })
    FakeBroadcastChannel.instances[0]?.emit({ workspaceId: '' })
    FakeBroadcastChannel.instances[0]?.emit({ ignored: true })

    expect(listener).toHaveBeenCalledTimes(2)
    unsubscribe()
  })
})
