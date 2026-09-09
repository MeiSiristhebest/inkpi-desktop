import { spawn, type ChildProcess } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AiTask, SkillRuntimeRegistrationSnapshot } from '@inkpi/protocol'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { connectToDaemon } from '../core/daemonConnection'
import { createDaemonSkillRuntime, FIRST_PARTY_SKILL_IDS } from './daemonSkillRuntime'
import { inkpiDaemonGateway } from './inkpiDaemonGateway'
import type { AiGateway, RpcClient } from '../ports/aiGateway'

interface DaemonReadyMessage {
  type: 'ready'
  tcpPort: number
  wsPort: number
}

interface DaemonHarness {
  child: ChildProcess
  ready: Promise<DaemonReadyMessage>
}

interface ObservedClient {
  client: RpcClient
  calls: Array<{ method: string; params: unknown }>
}

const desktopRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const fixturePath = resolve(desktopRoot, 'tests/fixtures/desktopSkillRuntimeHarness.mjs')
let harness: DaemonHarness | undefined
let daemon: DaemonReadyMessage

describe('Desktop production skill runtime over daemon RPC', () => {
  beforeEach(async () => {
    harness = startDaemonHarness()
    daemon = await harness.ready
  }, 30_000)

  afterEach(async () => {
    if (harness) await stopDaemonHarness(harness.child)
    harness = undefined
  }, 15_000)

  it('keeps discover/status metadata-only and retries failed activation without duplicate registrations', async () => {
    const observed = await connectObservedClient()
    const runtime = createDaemonSkillRuntime(observed.client)

    try {
      const discovered = await runtime.discover()
      const resolved = await runtime.resolve({ capability: 'continuity-audit' })
      const beforeActivation = await runtime.status()

      expect(discovered.map((skill) => skill.id)).toEqual([...FIRST_PARTY_SKILL_IDS].sort())
      expect(resolved.map((skill) => skill.id)).toEqual(['promise', 'timeline-consistency'])
      expect(beforeActivation).toMatchObject({
        loadedSkills: [],
        activatedSkills: [],
        instructions: [],
      })
      expect(JSON.stringify(discovered)).not.toContain('Track each promise')
      expect(JSON.stringify(resolved)).not.toContain('Track each promise')
      expect(JSON.stringify(beforeActivation)).not.toContain('Track each promise')

      await expect(runtime.ensureFirstPartySkillsActivated()).rejects.toThrow(
        'promise activation failed once',
      )
      const afterFailure = await runtime.status()
      expect(afterFailure.activatedSkills).toEqual(['hook'])
      expect(JSON.stringify(afterFailure)).not.toContain('Track each promise')

      const activated = await runtime.ensureFirstPartySkillsActivated()
      const repeated = await runtime.ensureFirstPartySkillsActivated()
      const finalStatus = await runtime.status()

      expect(activated.activatedSkills).toEqual([...FIRST_PARTY_SKILL_IDS].sort())
      expect(repeated).toEqual(activated)
      expect(finalStatus.loadedSkills).toEqual([...FIRST_PARTY_SKILL_IDS].sort())
      expect(finalStatus.activatedSkills).toEqual([...FIRST_PARTY_SKILL_IDS].sort())
      expect(finalStatus.instructions?.map((instruction) => instruction.id).sort()).toEqual(
        [...FIRST_PARTY_SKILL_IDS].map((skillId) => `skill.${skillId}`).sort(),
      )
      expect(new Set(finalStatus.instructions?.map((instruction) => instruction.id)).size).toBe(
        FIRST_PARTY_SKILL_IDS.length,
      )
      expect(JSON.stringify(finalStatus)).not.toContain('Track each promise')

      const activationCalls = observed.calls.filter(({ method }) => method === 'skill.activate')
      expect(activationCalls.map(({ params }) => (params as { skillId: string }).skillId)).toEqual([
        'hook',
        'promise',
        'promise',
        'character-voice',
        'timeline-consistency',
      ])
      expect(observed.calls.filter(({ method }) => method === 'skill.status')).toHaveLength(5)
    } finally {
      await observed.client.close()
    }
  }, 30_000)

  it('activates the first-party set during assistant connection and retries before the first task', async () => {
    const calls: Array<{ method: string; params: unknown }> = []
    let connectionCount = 0
    let closedConnectionCount = 0
    let connectedRpcClient: RpcClient | undefined
    const gateway: AiGateway = {
      connect: async (url) => {
        connectionCount += 1
        const raw = await inkpiDaemonGateway.connect(url)
        const client: RpcClient = {
          request: <T>(method: string, params?: unknown): Promise<T> => {
            calls.push({ method, params })
            return raw.request<T>(method, params)
          },
          close: async () => {
            closedConnectionCount += 1
            await raw.close()
          },
        }
        connectedRpcClient = client
        return client
      },
    }
    const retryTask = assistantTask('desktop-skill-retry')

    const testGlobal = globalThis as typeof globalThis & { WebSocket?: unknown }
    const browserWebSocket = testGlobal.WebSocket
    try {
      testGlobal.WebSocket = undefined
      const connection = await connectToDaemon(gateway, `ws://127.0.0.1:${daemon.wsPort}`, {
        isTauri: false,
        maxAttempts: 2,
        retryDelayMs: 0,
      })
      expect(connection.connected).toBe(true)
      if (!connection.client) throw new Error('assistant connection was not created')
      if (!connectedRpcClient) throw new Error('RPC client was not created')
      const assistant = connection.client
      expect(calls.some(({ method }) => method === 'task.submit')).toBe(false)
      expect(calls.filter(({ method }) => method === 'skill.activate')).toHaveLength(5)

      try {
        const result = await assistant.runTask(retryTask, { pollIntervalMs: 0 })
        expect(result).toMatchObject({
          taskId: retryTask.id,
          status: 'completed',
          output: { format: 'text', text: 'desktop-skill-runtime-fixture:completed' },
        })

        const status =
          await connectedRpcClient.request<SkillRuntimeRegistrationSnapshot>('skill.status')
        expect(status.activatedSkills).toEqual([...FIRST_PARTY_SKILL_IDS].sort())
        expect(
          status.instructions
            ?.map((instruction) => instruction.id)
            .filter((instructionId) => instructionId.startsWith('skill.'))
            .sort(),
        ).toEqual([...FIRST_PARTY_SKILL_IDS].map((skillId) => `skill.${skillId}`).sort())
        expect(calls.filter(({ method }) => method === 'skill.activate')).toHaveLength(5)
        expect(calls.filter(({ method }) => method === 'instruction.register')).toHaveLength(1)
        expect(calls.filter(({ method }) => method === 'task.submit')).toHaveLength(1)
        expect(connectionCount).toBe(2)
        expect(closedConnectionCount).toBe(1)
      } finally {
        await assistant.close()
      }
    } finally {
      testGlobal.WebSocket = browserWebSocket
    }
  }, 30_000)
})

function assistantTask(id: string): AiTask {
  return {
    id,
    kind: 'creative.assistant',
    input: { text: `input:${id}` },
    outputContract: { format: 'text' },
  }
}

async function connectObservedClient(): Promise<ObservedClient> {
  const testGlobal = globalThis as typeof globalThis & { WebSocket?: unknown }
  const browserWebSocket = testGlobal.WebSocket
  testGlobal.WebSocket = undefined
  try {
    const raw = await inkpiDaemonGateway.connect(`ws://127.0.0.1:${daemon.wsPort}`)
    const calls: Array<{ method: string; params: unknown }> = []
    const client: RpcClient = {
      request: <T>(method: string, params?: unknown): Promise<T> => {
        calls.push({ method, params })
        return raw.request<T>(method, params)
      },
      close: () => raw.close(),
    }
    return { client, calls }
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
        new Error(`Timed out waiting for skill fixture. stdout=${stdout} stderr=${stderr}`),
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
      if (child.exitCode === null && child.signalCode === null) child.kill()
      rejectReady(error)
    }
    const onStdout = (chunk: Buffer) => {
      stdout += chunk.toString()
      const lines = stdout.split(/\r?\n/)
      stdout = lines.pop() ?? ''
      for (const line of lines) {
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
          // Ignore non-JSON diagnostics until the ready event arrives.
        }
      }
    }
    const onStderr = (chunk: Buffer) => {
      stderr += chunk.toString()
    }
    const onError = (error: Error) => finishReject(error)
    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      finishReject(
        new Error(
          `Skill fixture exited before ready: code=${code ?? 'null'} signal=${signal ?? 'null'} stderr=${stderr}`,
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
    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      child.off('exit', onExit)
      resolveStop()
    }
    const onExit = () => finish()
    const timeout = setTimeout(() => {
      if (!child.killed) child.kill('SIGKILL')
      finish()
    }, 5_000)
    child.once('exit', onExit)
    child.kill('SIGTERM')
  })
}
