// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { renderHook, waitFor, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiTask } from '@inkpi/protocol'
import type { AiAssistant } from '../ports/aiGateway'
import type { Clock } from '../ports/clock'
import { IndexedDbTaskRecoveryStore, type TaskRecoveryRecord } from '../db/taskRecoveryStore'
import { useAiConversation } from '../hooks/useAiConversation'

const { connectToDaemon } = vi.hoisted(() => ({ connectToDaemon: vi.fn() }))

vi.mock('../core/daemonConnection', () => ({ connectToDaemon }))
vi.mock('../adapters/inkpiDaemonGateway', () => ({ inkpiDaemonGateway: {} }))

const projectId = 'desktop-restart-evidence-project'

const makeTask = (id: string): AiTask => ({
  id,
  kind: 'narrative.project.distill',
  input: { documentId: 'project-document', text: '长任务正文' },
})

const makeAssistant = (): AiAssistant => ({
  runTask: vi.fn(async () => null),
  resumeTask: vi.fn(async () => undefined),
  status: vi.fn(async () => ({ running: true })),
  close: vi.fn(async () => undefined),
})

const fixedClock: Clock = { now: () => 200 }

beforeEach(() => {
  connectToDaemon.mockReset()
})

describe('Desktop App restart recovery evidence', () => {
  it('rehydrates a persisted long-task checkpoint through a fresh store instance', async () => {
    const task = makeTask('desktop-restart-long-task')
    const persisted: TaskRecoveryRecord = {
      projectId,
      task,
      snapshot: {
        taskId: task.id,
        kind: task.kind,
        status: 'checkpointed',
        progress: 0.5,
        checkpoint: { step: 'chunk-12', updatedAt: 150 },
      },
      updatedAt: 150,
    }

    const beforeRestart = new IndexedDbTaskRecoveryStore()
    await beforeRestart.save(persisted)

    const assistant = makeAssistant()
    connectToDaemon.mockResolvedValue({ client: assistant, connected: true })
    const afterRestart = new IndexedDbTaskRecoveryStore()
    const hook = renderHook(() => useAiConversation('ws://daemon', null, projectId, {
      taskRecoveryStore: afterRestart,
      clock: fixedClock,
    }))

    await waitFor(() => expect(hook.result.current.taskRecovery).toHaveLength(1))
    expect(hook.result.current.taskRecovery[0]).toMatchObject({
      projectId,
      task,
      snapshot: {
        status: 'interrupted',
        progress: 0.5,
        checkpoint: { step: 'chunk-12', updatedAt: 150 },
      },
      updatedAt: 200,
    })

    await waitFor(async () => {
      await expect(afterRestart.list(projectId)).resolves.toMatchObject([{
        task,
        snapshot: expect.objectContaining({
          status: 'interrupted',
          checkpoint: { step: 'chunk-12', updatedAt: 150 },
        }),
      }])
    })

    await act(async () => {
      await expect(hook.result.current.resumeTask(task.id)).resolves.toBe(true)
    })
    expect(assistant.resumeTask).toHaveBeenCalledWith(task.id)
    expect(hook.result.current.taskRecovery[0].snapshot.status).toBe('queued')

    hook.unmount()
    await afterRestart.remove(projectId, task.id)
  })
})
