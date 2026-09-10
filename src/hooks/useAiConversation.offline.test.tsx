import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiAssistant } from '../ports/aiGateway'
import type { TaskRecoveryRecord, TaskRecoveryStore } from '../db/taskRecoveryStore'
import { domainChangeEvents } from '../ports/domainChangeEvents'
import { useAiConversation } from './useAiConversation'

const { connectToDaemon } = vi.hoisted(() => ({ connectToDaemon: vi.fn() }))

vi.mock('../core/daemonConnection', () => ({ connectToDaemon }))
vi.mock('../adapters/inkpiDaemonGateway', () => ({ inkpiDaemonGateway: {} }))

function makeStore(): TaskRecoveryStore {
  return {
    list: vi.fn(async (_projectId: string): Promise<TaskRecoveryRecord[]> => []),
    save: vi.fn(async (_record: TaskRecoveryRecord) => undefined),
    remove: vi.fn(async (_projectId: string, _taskId: string) => undefined),
  }
}

beforeEach(() => {
  connectToDaemon.mockReset()
})

describe('useAiConversation offline recovery', () => {
  it('defers local domain sync while offline and syncs the authoritative state after reconnect', async () => {
    const syncDomain = vi.fn(async () => ({
      workspaceId: 'project-1',
      pushed: 1,
      pulled: 0,
      revision: 2,
      recovered: false,
    }))
    const assistant: AiAssistant = {
      runTask: vi.fn(async () => null),
      status: vi.fn(async () => ({ running: true })),
      close: vi.fn(async () => undefined),
      syncDomain,
    }
    connectToDaemon
      .mockResolvedValueOnce({ client: null, connected: false })
      .mockResolvedValueOnce({ client: assistant, connected: true })

    const store = makeStore()
    const hook = renderHook(() => useAiConversation('ws://daemon', null, 'project-1', {
      taskRecoveryStore: store,
    }))

    await waitFor(() => expect(connectToDaemon).toHaveBeenCalledTimes(1))
    act(() => {
      domainChangeEvents.publish('project-1')
    })
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(syncDomain).not.toHaveBeenCalled()

    act(() => {
      hook.result.current.reconnect()
    })
    await waitFor(() => expect(hook.result.current.isConnected).toBe(true))
    await waitFor(() => expect(syncDomain).toHaveBeenCalledWith('project-1'))
    expect(syncDomain).toHaveBeenCalledTimes(1)

    hook.unmount()
  })
})
