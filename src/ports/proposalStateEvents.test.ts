import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { proposalStateEvents, type ProposalStateChangedEvent } from './proposalStateEvents'

class FakeBroadcastChannel {
  static instances: FakeBroadcastChannel[] = []
  static throwOnConstruct = false
  private readonly listeners = new Set<(event: { data: unknown }) => void>()

  constructor(_name: string) {
    if (FakeBroadcastChannel.throwOnConstruct) throw new Error('BroadcastChannel unavailable')
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
  FakeBroadcastChannel.throwOnConstruct = false
  vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel)
})

afterAll(() => {
  vi.unstubAllGlobals()
})

const event: ProposalStateChangedEvent = {
  workspaceId: 'workspace-1',
  projectId: 'project-1',
  proposalId: 'proposal-1',
  status: 'committed',
  kind: 'updated',
  updatedAt: 12,
}

describe('proposal state events', () => {
  it('safely degrades when BroadcastChannel cannot be constructed', () => {
    const listener = vi.fn()
    const unsubscribe = proposalStateEvents.subscribe(
      { workspaceId: 'workspace-fallback', projectId: 'project-fallback' },
      listener,
    )
    FakeBroadcastChannel.throwOnConstruct = true

    expect(() => proposalStateEvents.publish({ ...event, workspaceId: 'workspace-fallback', projectId: 'project-fallback' })).not.toThrow()
    expect(listener).toHaveBeenCalledOnce()
    unsubscribe()
  })

  it('filters local events by workspace and project', () => {
    const matching = vi.fn()
    const workspaceOnly = vi.fn()
    const otherWorkspace = vi.fn()
    const subscriptions = [
      proposalStateEvents.subscribe({ workspaceId: 'workspace-1', projectId: 'project-1' }, matching),
      proposalStateEvents.subscribe({ workspaceId: 'workspace-1' }, workspaceOnly),
      proposalStateEvents.subscribe({ workspaceId: 'workspace-2', projectId: 'project-1' }, otherWorkspace),
    ]

    proposalStateEvents.publish(event)
    proposalStateEvents.publish({ ...event, projectId: 'project-2', proposalId: 'proposal-2' })

    expect(matching).toHaveBeenCalledOnce()
    expect(workspaceOnly).toHaveBeenCalledTimes(2)
    expect(otherWorkspace).not.toHaveBeenCalled()
    for (const unsubscribe of subscriptions) unsubscribe()
  })

  it('accepts only valid external events for the subscribed scope', () => {
    const listener = vi.fn()
    const unsubscribe = proposalStateEvents.subscribe({ workspaceId: 'workspace-1', projectId: 'project-1' }, listener)
    const channel = FakeBroadcastChannel.instances[FakeBroadcastChannel.instances.length - 1]

    channel?.emit(event)
    channel?.emit({ ...event, projectId: 'project-other' })
    channel?.emit({ ...event, kind: 'unknown' })
    channel?.emit({ workspaceId: 'workspace-1', proposalId: 'missing-status', kind: 'updated' })

    expect(listener).toHaveBeenCalledOnce()
    expect(listener).toHaveBeenCalledWith(event)
    unsubscribe()
  })
})
