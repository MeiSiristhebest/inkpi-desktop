import 'fake-indexeddb/auto'
import { spawn, type ChildProcess } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import type { AiTask, TaskExecutionSnapshot, TaskStatusSnapshot } from '@inkpi/protocol'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Clock } from '../ports/clock'
import { bootstrapDesktopTaskRecovery } from './desktopTaskRecoveryBootstrap'
import { createDaemonAiAssistant } from './daemonAiAssistant'
import { inkpiDaemonGateway } from './inkpiDaemonGateway'
import { IndexedDbTaskRecoveryStore } from '../db/taskRecoveryStore'
import type { RpcClient } from '../ports/aiGateway'

interface DaemonReadyMessage {
  type: 'ready'
  tcpPort: number
  wsPort: number
  processId: number
}

interface DaemonHarness {
  child: ChildProcess
  ready: Promise<DaemonReadyMessage>
}

const desktopRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const fixturePath = resolve(desktopRoot, 'tests/fixtures/desktopTaskRecoveryHarness.mjs')
const databasePath = resolve(tmpdir(), `inkpi-task-recovery-${randomUUID()}.sqlite`)
const projectId = 'desktop-cross-process-recovery-project'
const task: AiTask = {
  id: 'desktop-cross-process-recovery-task',
  kind: 'desktop.task-recovery.fixture',
  input: { payload: { documentId: 'recovery-document', revision: 3 } },
  executionPolicy: {
    mode: 'foreground',
    cancellable: true,
    checkpoint: { enabled: true, step: 'phase-1' },
  },
  outputContract: { format: 'structured', persistence: 'ephemeral' },
  effectPolicy: { mode: 'read-only' },
}
const fixedClock: Clock = { now: () => 2_000 }
let harness: DaemonHarness | undefined

describe('Desktop ↔ daemon task recovery across process restart', () => {
  beforeAll(async () => {
    harness = startDaemonHarness()
    await harness.ready
  }, 30_000)

  afterAll(async () => {
    if (harness) await stopDaemonHarness(harness.child)
  }, 15_000)

  it('rehydrates a durable checkpoint, resumes through the Desktop adapter, and clears the App record', async () => {
    const firstReady = await harness!.ready
    const firstDaemon = await connectClient(firstReady)
    const beforeRestartStore = new IndexedDbTaskRecoveryStore()
    let checkpointed: TaskExecutionSnapshot

    try {
      await firstDaemon.request('task.submit', { task })
      checkpointed = await waitForExecution(firstDaemon, (execution) => {
        return execution.snapshot.checkpoint?.step === 'phase-1'
      })
      expect(checkpointed.snapshot.status).toBe('running')
      expect(checkpointed.snapshot.checkpoint).toMatchObject({ step: 'phase-1' })

      await beforeRestartStore.save({
        projectId,
        task,
        snapshot: checkpointed.snapshot,
        updatedAt: 1_000,
      })
    } finally {
      await firstDaemon.close()
    }

    await stopDaemonHarness(harness!.child)
    harness = startDaemonHarness()
    const restartedDaemon = await harness.ready
    expect(restartedDaemon.processId).not.toBe(firstReady.processId)
    const secondDaemon = await connectClient(restartedDaemon)
    const afterRestartStore = new IndexedDbTaskRecoveryStore()

    try {
      const interrupted = await waitForExecution(secondDaemon, (execution) => {
        return execution.snapshot.status === 'interrupted'
      })
      expect(interrupted.snapshot).toMatchObject({
        taskId: task.id,
        kind: task.kind,
        status: 'interrupted',
        checkpoint: { step: 'phase-1' },
        error: { code: 'TASK_INTERRUPTED' },
      })
      expect(interrupted.attempts).toBe(1)

      const recoveryReport = await bootstrapDesktopTaskRecovery({
        projectId,
        store: afterRestartStore,
        clock: fixedClock,
        getTaskExecution: (taskId) =>
          secondDaemon.request<TaskExecutionSnapshot>('task.execution', { taskId }),
      })
      expect(recoveryReport).toMatchObject({
        projectId,
        recoveredTaskIds: [task.id],
        completedTaskIds: [],
        issues: [],
        records: [
          {
            projectId,
            task,
            snapshot: {
              status: 'interrupted',
              checkpoint: { step: 'phase-1' },
            },
            updatedAt: 2_000,
          },
        ],
      })

      const assistant = createDaemonAiAssistant(secondDaemon)
      await assistant.resumeTask(task.id)
      const completed = await waitForExecution(
        secondDaemon,
        (execution) => execution.snapshot.status === 'completed',
      )
      expect(completed.snapshot).toMatchObject<TaskStatusSnapshot>({
        taskId: task.id,
        kind: task.kind,
        status: 'completed',
        attempts: 1,
      })
      expect(completed.snapshot.result).toMatchObject({
        output: {
          format: 'structured',
          data: {
            resumedFrom: 'phase-1',
            checkpointData: {
              persistedBy: 'desktop-task-recovery-fixture',
              source: task.input.payload,
            },
            attempt: 1,
          },
        },
        provenance: {
          fixture: 'desktop-task-recovery-harness',
          processId: restartedDaemon.processId,
        },
      })

      const cleanupReport = await bootstrapDesktopTaskRecovery({
        projectId,
        store: afterRestartStore,
        clock: fixedClock,
        getTaskExecution: (taskId) =>
          secondDaemon.request<TaskExecutionSnapshot>('task.execution', { taskId }),
      })
      expect(cleanupReport.completedTaskIds).toEqual([task.id])
      await expect(afterRestartStore.list(projectId)).resolves.toEqual([])
    } finally {
      await secondDaemon.close()
    }
  }, 45_000)
})

async function connectClient(ready?: DaemonReadyMessage): Promise<RpcClient> {
  const current = ready ?? (await harness!.ready)
  const testGlobal = globalThis as typeof globalThis & { WebSocket?: unknown }
  const browserWebSocket = testGlobal.WebSocket
  testGlobal.WebSocket = undefined
  try {
    return await inkpiDaemonGateway.connect(`ws://127.0.0.1:${current.wsPort}`)
  } finally {
    testGlobal.WebSocket = browserWebSocket
  }
}

async function waitForExecution(
  client: RpcClient,
  predicate: (execution: TaskExecutionSnapshot) => boolean,
): Promise<TaskExecutionSnapshot> {
  const deadline = Date.now() + 10_000
  let latest: TaskExecutionSnapshot | undefined
  while (Date.now() < deadline) {
    latest = await client.request<TaskExecutionSnapshot>('task.execution', { taskId: task.id })
    if (predicate(latest)) return latest
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 10))
  }
  throw new Error(`Timed out waiting for task execution state: ${JSON.stringify(latest)}`)
}

function startDaemonHarness(): DaemonHarness {
  const child = spawn(process.execPath, [fixturePath], {
    cwd: desktopRoot,
    env: {
      ...process.env,
      INKPI_TASK_RECOVERY_DB: databasePath,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  return { child, ready: waitForDaemonReady(child) }
}

function waitForDaemonReady(child: ChildProcess): Promise<DaemonReadyMessage> {
  return new Promise((resolveReady, rejectReady) => {
    let stdout = ''
    let stderr = ''
    let settled = false
    const timeout = setTimeout(() => {
      finishReject(
        new Error(`Timed out waiting for task recovery fixture. stdout=${stdout} stderr=${stderr}`),
      )
    }, 20_000)

    const finishResolve = (message: DaemonReadyMessage) => {
      if (settled) return
      settled = true
      cleanup()
      resolveReady(message)
    }
    const finishReject = (error: Error) => {
      if (settled) return
      settled = true
      cleanup()
      child.kill()
      rejectReady(error)
    }
    const onStdout = (chunk: Buffer) => {
      stdout += chunk.toString()
      for (const line of stdout.split(/\r?\n/).slice(0, -1)) {
        if (!line.trim()) continue
        try {
          const message = JSON.parse(line) as Partial<DaemonReadyMessage>
          if (
            message.type === 'ready' &&
            typeof message.tcpPort === 'number' &&
            typeof message.wsPort === 'number' &&
            typeof message.processId === 'number'
          ) {
            finishResolve(message as DaemonReadyMessage)
            return
          }
        } catch {
          // Ignore non-JSON diagnostic lines until the ready message arrives.
        }
      }
      stdout = stdout.split(/\r?\n/).at(-1) ?? ''
    }
    const onStderr = (chunk: Buffer) => {
      stderr += chunk.toString()
    }
    const onError = (error: Error) => finishReject(error)
    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      finishReject(
        new Error(
          `Task recovery fixture exited before ready: code=${code ?? 'null'} signal=${signal ?? 'null'} stderr=${stderr}`,
        ),
      )
    }
    const cleanup = () => {
      clearTimeout(timeout)
      child.stdout?.off('data', onStdout)
      child.stderr?.off('data', onStderr)
      child.off('error', onError)
      child.off('exit', onExit)
    }

    child.stdout?.on('data', onStdout)
    child.stderr?.on('data', onStderr)
    child.once('error', onError)
    child.once('exit', onExit)
  })
}

async function stopDaemonHarness(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return
  await new Promise<void>((resolveStop) => {
    let settled = false
    const timeout = setTimeout(() => {
      child.kill()
      finish()
    }, 5_000)
    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      child.off('exit', finish)
      resolveStop()
    }
    child.once('exit', finish)
    child.kill()
  })
}
