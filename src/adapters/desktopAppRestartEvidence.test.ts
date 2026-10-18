// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { render, renderHook, screen, waitFor, act } from '@testing-library/react'
import { createElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiTask } from '@inkpi/protocol'
import type { AiAssistant } from '../ports/aiGateway'
import type { Clock } from '../ports/clock'
import { AiActivityCenter } from '../components/ai/AiActivityCenter'
import { IndexedDbArtifactStore, type AiArtifact } from '../ai/artifacts/artifactStore'
import { loadWorkspaceResults } from '../ai/results/resultCenter'
import { db } from '../db/indexedDB'
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

const makeAssistant = (getTaskExecution?: AiAssistant['getTaskExecution']): AiAssistant => ({
  runTask: vi.fn(async () => null),
  ...(getTaskExecution ? { getTaskExecution } : {}),
  resumeTask: vi.fn(async () => undefined),
  status: vi.fn(async () => ({ running: true })),
  close: vi.fn(async () => undefined),
})

const fixedClock: Clock = { now: () => 200 }

beforeEach(() => {
  connectToDaemon.mockReset()
})

describe('Desktop App restart recovery evidence', () => {
  it('shows a persisted result after a fresh store and Activity Center mount', async () => {
    const documentId = 'desktop-restart-result-chapter'
    const artifact: AiArtifact = {
      id: 'desktop-restart-result',
      taskId: 'desktop-restart-result-task',
      kind: 'narrative.continuity.audit',
      type: 'creative.audit-report',
      version: 1,
      documentId,
      content: { summary: '重启后仍可查看的检查结果' },
      provenance: { sourceRevision: 7 },
      ownership: { owner: 'desktop', authoritative: true, workspaceId: projectId },
      metadata: { title: '重启后的连续性诊断' },
      createdAt: 160,
      updatedAt: 160,
    }

    await db.delete('aiArtifacts', artifact.id)
    try {
      await new IndexedDbArtifactStore().save(artifact)

      const reloadedArtifacts = await new IndexedDbArtifactStore().listByWorkspace(projectId)
      const results = await loadWorkspaceResults(projectId, reloadedArtifacts)
      expect(results.map((result) => result.id)).toEqual([artifact.id])

      render(
        createElement(AiActivityCenter, {
          recoveryRecords: [],
          results,
          focusedResultId: artifact.id,
          currentDocumentRevisions: new Map([[documentId, 8]]),
        }),
      )

      expect(await screen.findByTestId(`activity-result-${artifact.id}`)).toBeInTheDocument()
      expect(screen.getByTestId(`activity-result-${artifact.id}`)).toHaveAttribute(
        'aria-current',
        'true',
      )
      expect(screen.getByTestId(`result-summary-${artifact.id}`)).toHaveTextContent(
        '重启后仍可查看的检查结果',
      )
      expect(screen.getByTestId(`result-source-changed-${artifact.id}`)).toHaveTextContent(
        '来源版本已变化：分析 r7，当前 r8',
      )
      expect(await screen.findByTestId(`result-details-${artifact.id}`)).toHaveTextContent(
        `结果记录: ${artifact.id}`,
      )
    } finally {
      await db.delete('aiArtifacts', artifact.id)
    }
  })

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
    const hook = renderHook(() =>
      useAiConversation('ws://daemon', null, projectId, {
        taskRecoveryStore: afterRestart,
        clock: fixedClock,
      }),
    )

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
      await expect(afterRestart.list(projectId)).resolves.toMatchObject([
        {
          task,
          snapshot: expect.objectContaining({
            status: 'interrupted',
            checkpoint: { step: 'chunk-12', updatedAt: 150 },
          }),
        },
      ])
    })

    await act(async () => {
      await expect(hook.result.current.resumeTask(task.id)).resolves.toBe(true)
    })
    expect(assistant.resumeTask).toHaveBeenCalledWith(task.id)
    expect(hook.result.current.taskRecovery[0].snapshot.status).toBe('queued')

    hook.unmount()
    await afterRestart.remove(projectId, task.id)
  })

  it('reconciles a daemon-completed task and removes the stale App record after reconnect', async () => {
    const task = makeTask('desktop-restart-completed-task')
    const beforeRestart = new IndexedDbTaskRecoveryStore()
    await beforeRestart.save({
      projectId,
      task,
      snapshot: {
        taskId: task.id,
        kind: task.kind,
        status: 'running',
        checkpoint: { step: 'chunk-12', updatedAt: 150 },
      },
      updatedAt: 150,
    })

    const getTaskExecution = vi.fn(async () => ({
      task,
      snapshot: {
        taskId: task.id,
        kind: task.kind,
        status: 'completed' as const,
        finishedAt: 250,
      },
      attempts: 1,
      updatedAt: 250,
    }))
    const assistant = makeAssistant(getTaskExecution)
    connectToDaemon.mockResolvedValue({ client: assistant, connected: true })
    const afterRestart = new IndexedDbTaskRecoveryStore()
    const hook = renderHook(() =>
      useAiConversation('ws://daemon', null, projectId, {
        taskRecoveryStore: afterRestart,
        clock: fixedClock,
      }),
    )

    await waitFor(() => expect(getTaskExecution).toHaveBeenCalledWith(task.id))
    await waitFor(async () => {
      await expect(afterRestart.list(projectId)).resolves.toEqual([])
    })
    expect(hook.result.current.taskRecovery).toEqual([])

    hook.unmount()
  })

  it('reattaches the persisted task again when an already running App reconnects', async () => {
    const task = makeTask('desktop-reconnect-task')
    const store = new IndexedDbTaskRecoveryStore()
    await store.save({
      projectId,
      task,
      snapshot: {
        taskId: task.id,
        kind: task.kind,
        status: 'running',
      },
      updatedAt: 150,
    })

    const firstExecution = vi.fn(async () => ({
      task,
      snapshot: {
        taskId: task.id,
        kind: task.kind,
        status: 'running' as const,
        progress: 0.25,
      },
      attempts: 1,
      updatedAt: 200,
    }))
    const secondExecution = vi.fn(async () => ({
      task,
      snapshot: {
        taskId: task.id,
        kind: task.kind,
        status: 'checkpointed' as const,
        progress: 0.5,
        checkpoint: { step: 'chunk-12', updatedAt: 250 },
      },
      attempts: 1,
      updatedAt: 250,
    }))
    const first = makeAssistant(firstExecution)
    const second = makeAssistant(secondExecution)
    connectToDaemon
      .mockResolvedValueOnce({ client: first, connected: true })
      .mockResolvedValueOnce({ client: second, connected: true })

    const hook = renderHook(() =>
      useAiConversation('ws://daemon', null, projectId, {
        taskRecoveryStore: store,
        clock: fixedClock,
      }),
    )

    await waitFor(() => expect(firstExecution).toHaveBeenCalledWith(task.id))
    await waitFor(() =>
      expect(hook.result.current.taskRecovery[0]?.snapshot.status).toBe('running'),
    )

    await act(async () => {
      hook.result.current.reconnect()
      await waitFor(() => expect(connectToDaemon).toHaveBeenCalledTimes(2))
    })
    await waitFor(() => expect(secondExecution).toHaveBeenCalledWith(task.id))
    await waitFor(() =>
      expect(hook.result.current.taskRecovery[0]?.snapshot.status).toBe('checkpointed'),
    )
    expect(second.close).not.toHaveBeenCalled()
    expect(first.close).toHaveBeenCalledOnce()

    hook.unmount()
    expect(second.close).toHaveBeenCalledOnce()
  })
})
