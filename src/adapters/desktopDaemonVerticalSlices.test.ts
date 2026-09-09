import { spawn, type ChildProcess } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { TaskStatusSnapshot } from '@inkpi/protocol'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { semanticDocumentFromText } from '../domain/content'
import {
  createContinuityAuditTask,
  createDeepReasoningTask,
  createDistillationTask,
  createRewriteTask,
} from '../ai/tasks/taskFactories'
import { createDaemonAiAssistant } from './daemonAiAssistant'
import { inkpiDaemonGateway } from './inkpiDaemonGateway'
import type { RpcClient } from '../ports/aiGateway'

interface DaemonReadyMessage {
  type: 'ready'
  tcpPort: number
  wsPort: number
}

interface DaemonHarness {
  child: ChildProcess
  ready: Promise<DaemonReadyMessage>
}

const desktopRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const fixturePath = resolve(desktopRoot, 'tests/fixtures/desktopDaemonVerticalSlicesHarness.mjs')
let harness: DaemonHarness | undefined
let daemon: DaemonReadyMessage

describe('Desktop ↔ InkPi daemon vertical slice integration', () => {
  beforeAll(async () => {
    harness = startDaemonHarness()
    daemon = await harness.ready
  }, 30_000)

  afterAll(async () => {
    if (harness) await stopDaemonHarness(harness.child)
  }, 15_000)

  it('runs the four remaining Desktop task factories through a real daemon process', async () => {
    const { client, assistant } = await connectAssistant()
    try {
      const document = semanticDocumentFromText(
        'desktop-vertical-slices-doc',
        '雨停后，门外只剩一盏冷灯。她没有回头。',
        11,
      )
      const tasks = [
        createRewriteTask({
          taskId: 'desktop-daemon-rewrite',
          document,
          selection: { from: 0, to: 6 },
          goal: '保留事实并收紧句子。',
          instruction: '返回可应用的文本 patch。',
        }),
        createContinuityAuditTask({
          taskId: 'desktop-daemon-continuity',
          document,
          scope: 'document',
          instruction: '检查当前章节的连续性。',
        }),
        createDeepReasoningTask({
          taskId: 'desktop-daemon-reasoning',
          document,
          question: '下一场应该保留哪些叙事约束？',
          depth: 'focused',
          instruction: '给出结构化结论。',
        }),
        createDistillationTask({
          taskId: 'desktop-daemon-distillation',
          document,
          target: 'project',
          fields: ['entities', 'events', 'promises'],
          instruction: '提取当前文本中的稳定事实。',
        }),
      ]

      for (const task of tasks) {
        const progress: TaskStatusSnapshot[] = []
        const result = await assistant.runTask(task, {
          pollIntervalMs: 10,
          onProgress: (snapshot) => progress.push(snapshot),
        })

        expect(result).toMatchObject({
          taskId: task.id,
          kind: task.kind,
          status: 'completed',
          provenance: {
            fixture: 'desktop-daemon-vertical-slices-harness',
            instructionIds: expect.arrayContaining([task.kind]),
            cacheHit: false,
          },
        })
        expect(result.output?.format).toBe(task.outputContract?.format)
        expect(progress.map((snapshot) => snapshot.status)).toContain('completed')
        expect(result.artifactIds?.length).toBeGreaterThan(0)

        const persisted = await client.request<TaskStatusSnapshot>('task.status', { taskId: task.id })
        expect(persisted).toMatchObject({
          taskId: task.id,
          kind: task.kind,
          status: 'completed',
          result: {
            taskId: task.id,
            kind: task.kind,
            status: 'completed',
            output: { format: task.outputContract?.format },
          },
        })
      }
    } finally {
      await client.close()
    }
  })
})

async function connectAssistant(): Promise<{
  client: RpcClient
  assistant: ReturnType<typeof createDaemonAiAssistant>
}> {
  const testGlobal = globalThis as typeof globalThis & { WebSocket?: unknown }
  const browserWebSocket = testGlobal.WebSocket
  testGlobal.WebSocket = undefined
  try {
    const client = await inkpiDaemonGateway.connect(`ws://127.0.0.1:${daemon.wsPort}`)
    return { client, assistant: createDaemonAiAssistant(client) }
  } finally {
    testGlobal.WebSocket = browserWebSocket
  }
}

function startDaemonHarness(): DaemonHarness {
  const child = spawn(process.execPath, [fixturePath], {
    cwd: desktopRoot,
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
      finishReject(new Error(`Timed out waiting for daemon fixture. stdout=${stdout} stderr=${stderr}`))
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
            typeof message.wsPort === 'number'
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
          `Daemon fixture exited before ready: code=${code ?? 'null'} signal=${signal ?? 'null'} stderr=${stderr}`,
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
