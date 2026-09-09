import { spawn, type ChildProcess } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import type { InstructionRegistryStatus, TaskStatusSnapshot } from '@inkpi/protocol'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { semanticDocumentFromText } from '../domain/content'
import { createAssistantTask, createContinueTask } from '../ai/tasks/taskFactories'
import { createPluginAnalysisTask } from '../ai/tasks/pluginTasks'
import { listCoreInstructionDefinitions } from '../ai/instructions/coreInstructions'
import { listPluginInstructionDefinitions } from '../ai/instructions/pluginInstructions'
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
const fixturePath = resolve(desktopRoot, 'tests/fixtures/desktopDaemonHarness.mjs')
let harness: DaemonHarness | undefined
let daemon: DaemonReadyMessage

describe('Desktop ↔ InkPi daemon RPC integration', () => {
  beforeAll(async () => {
    harness = startDaemonHarness()
    daemon = await harness.ready
  }, 30_000)

  afterAll(async () => {
    if (harness) await stopDaemonHarness(harness.child)
  }, 15_000)

  it('runs a Desktop task factory through the real client and daemon to completion', async () => {
    const { client, assistant } = await connectAssistant()
    try {
      await expect(assistant.status()).resolves.toMatchObject({ running: true })

      const task = createAssistantTask({
        taskId: 'desktop-daemon-completed',
        document: semanticDocumentFromText(
          'desktop-integration-doc',
          '雨停后，门外只剩一盏冷灯。',
          7,
        ),
        selection: { from: 0, to: 6 },
        question: '请确认真实 Desktop 到 daemon 的任务链路。',
        instruction: '保留当前语气。',
      })
      const progress: TaskStatusSnapshot[] = []

      const result = await assistant.runTask(task, {
        pollIntervalMs: 10,
        onProgress: (snapshot) => progress.push(snapshot),
      })

      expect(result).toMatchObject({
        taskId: task.id,
        kind: task.kind,
        status: 'completed',
        output: { format: 'text', text: 'desktop-daemon-fixture:completed' },
        provenance: {
          fixture: 'desktop-daemon-harness',
          instructionIds: expect.arrayContaining(['creative.assistant']),
        },
      })
      expect(progress.map((snapshot) => snapshot.status)).toContain('completed')

      const persisted = await client.request<TaskStatusSnapshot>('task.status', { taskId: task.id })
      expect(persisted).toMatchObject({
        taskId: task.id,
        kind: task.kind,
        status: 'completed',
        result: {
          taskId: task.id,
          kind: task.kind,
          status: 'completed',
          output: { format: 'text', text: 'desktop-daemon-fixture:completed' },
          provenance: {
            fixture: 'desktop-daemon-harness',
            instructionIds: expect.arrayContaining(['creative.assistant']),
          },
        },
      })
      expect(JSON.stringify(result.provenance)).not.toContain('private reasoning')
      expect(JSON.stringify(result.provenance)).not.toContain('private trace')
      expect(JSON.stringify(persisted.result?.provenance)).not.toContain('private reasoning')
      expect(JSON.stringify(persisted.result?.provenance)).not.toContain('private trace')

      const instructionStatus = await client.request<{
        ready: boolean
        count: number
        instructionIds: string[]
      }>('instruction.status')
      expect(instructionStatus).toMatchObject({ ready: true })
      expect(instructionStatus.count).toBeGreaterThan(0)
      expect(instructionStatus.instructionIds).toEqual(
        expect.arrayContaining(['creative.assistant', 'plugin.chekhov-radar.analysis']),
      )
    } finally {
      await client.close()
    }
  })

  it('returns a real waiting-user result through the Desktop task assistant', async () => {
    const { client, assistant } = await connectAssistant()
    try {
      const task = createContinueTask({
        taskId: 'desktop-daemon-waiting-user',
        document: semanticDocumentFromText('desktop-waiting-doc', '她把笔停在最后一个字上。'),
        targetCharacters: 40,
        instruction: '提交前等待作者确认。',
      })
      const progress: TaskStatusSnapshot[] = []

      const result = await assistant.runTask(task, {
        pollIntervalMs: 10,
        onProgress: (snapshot) => progress.push(snapshot),
      })

      expect(result).toMatchObject({
        taskId: task.id,
        kind: task.kind,
        status: 'waiting-user',
        output: { format: 'text', text: 'desktop-daemon-fixture:waiting-user' },
        provenance: {
          fixture: 'desktop-daemon-harness',
          instructionIds: expect.arrayContaining(['creative.continue']),
        },
      })
      expect(progress.map((snapshot) => snapshot.status)).toContain('waiting-user')

      const persisted = await client.request<TaskStatusSnapshot>('task.status', { taskId: task.id })
      expect(persisted).toMatchObject({
        taskId: task.id,
        kind: task.kind,
        status: 'waiting-user',
        result: {
          taskId: task.id,
          kind: task.kind,
          status: 'waiting-user',
          output: { format: 'text', text: 'desktop-daemon-fixture:waiting-user' },
          provenance: {
            fixture: 'desktop-daemon-harness',
            instructionIds: expect.arrayContaining(['creative.continue']),
          },
        },
      })
    } finally {
      await client.close()
    }
  })

  it('keeps Desktop instruction metadata aligned with Daemon references and task provenance', async () => {
    const { client, assistant } = await connectAssistant()
    try {
      const task = createPluginAnalysisTask({
        pluginId: 'reader-hook',
        input: { chapter: '雨停后，门外只剩一盏冷灯。' },
      })
      const result = await assistant.runTask(task, { pollIntervalMs: 10 })
      const status = await client.request<InstructionRegistryStatus>('instruction.status')
      const definitions = [
        ...listCoreInstructionDefinitions(),
        ...listPluginInstructionDefinitions(),
      ]

      expect(status).toMatchObject({
        ready: true,
        version: expect.stringMatching(/^instructions-\d+$/),
        count: definitions.length,
        instructionIds: definitions.map((definition) => definition.id),
      })
      expect(status.instructions).toHaveLength(definitions.length)
      expect(status.instructions).toEqual(expect.arrayContaining(definitions.map((definition) => {
        const taskKind = definition.taskKind ?? definition.id
        return expect.objectContaining({
          id: definition.id,
          scope: 'task',
          version: definition.version,
          source: `task:${taskKind}`,
          tags: [`task:${taskKind}`],
        })
      })))

      const taskReference = status.instructions.find((reference) => reference.id === task.kind)
      expect(result?.provenance).toMatchObject({
        instructionVersion: status.version,
        instructionIds: [task.kind],
        instructionProvenance: [taskReference],
      })

      const persisted = await client.request<TaskStatusSnapshot>('task.status', { taskId: task.id })
      expect(persisted.result?.provenance).toMatchObject({
        instructionVersion: status.version,
        instructionIds: [task.kind],
        instructionProvenance: [taskReference],
      })
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
  // jsdom's WebSocket and Node's Event use different realms. Use the client's
  // real Node `ws` fallback for this cross-process test, then restore jsdom.
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
      finishReject(
        new Error(`Timed out waiting for daemon fixture. stdout=${stdout} stderr=${stderr}`),
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
