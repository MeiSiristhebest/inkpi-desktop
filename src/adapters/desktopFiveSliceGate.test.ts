import { spawn, type ChildProcess } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Artifact as RuntimeArtifact, TaskOutput, TaskStatusSnapshot } from '@inkpi/protocol'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createContinueTask,
  createContinuityAuditTask,
  createDeepReasoningTask,
  createDistillationTask,
  createRewriteTask,
} from '../ai/tasks/taskFactories'
import {
  getProposalSyncRemote,
  hashText,
  ProposalLedger,
  proposalFromPatch,
  RemoteProposalStore,
  type AiProposal,
  type ProposalStore,
} from '../ai/proposals'
import { semanticDocumentFromText } from '../domain/content'
import { createDaemonAiAssistant } from './daemonAiAssistant'
import { createDaemonProposalSyncRemote } from './daemonDomainSyncRemote'
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

interface GateCase {
  task: ReturnType<
    | typeof createContinueTask
    | typeof createRewriteTask
    | typeof createContinuityAuditTask
    | typeof createDeepReasoningTask
    | typeof createDistillationTask
  >
  expectedOutput: TaskOutput
}

const desktopRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const fixturePath = resolve(desktopRoot, 'tests/fixtures/desktopFiveSliceGateHarness.mjs')
const workspaceId = 'desktop-five-slice-gate-workspace'
let harness: DaemonHarness | undefined
let daemon: DaemonReadyMessage

describe('Desktop ↔ InkPi daemon five-slice gate', () => {
  beforeAll(async () => {
    harness = startDaemonHarness()
    daemon = await harness.ready
  }, 30_000)

  afterAll(async () => {
    if (harness) await stopDaemonHarness(harness.child)
  }, 15_000)

  it('verifies all five task contracts and re-reads daemon artifacts/proposals after reconnect', async () => {
    const first = await connectAssistant()
    const document = semanticDocumentFromText(
      'desktop-five-slice-gate-document',
      '雨停后，门外只剩一盏冷灯。她没有回头。',
      13,
    )
    const cases: GateCase[] = [
      {
        task: createContinueTask({
          taskId: 'desktop-five-slice-gate-continue',
          document,
          selection: { from: document.text.length, to: document.text.length },
          instruction: '返回续写文本。',
        }),
        expectedOutput: { format: 'text', text: 'desktop-five-slice-gate:continuation' },
      },
      {
        task: createRewriteTask({
          taskId: 'desktop-five-slice-gate-rewrite',
          document,
          selection: { from: 0, to: 6 },
          goal: '收紧句子。',
          instruction: '返回 patch。',
        }),
        expectedOutput: {
          format: 'patch',
          patch: { from: 0, to: 6, text: '雨停后只剩冷灯。' },
        },
      },
      {
        task: createContinuityAuditTask({
          taskId: 'desktop-five-slice-gate-continuity',
          document,
          scope: 'document',
          instruction: '检查连续性。',
        }),
        expectedOutput: {
          format: 'structured',
          data: [
            {
              id: 'gate-continuity-finding',
              severity: 'warning',
              description: 'Gate continuity finding.',
            },
          ],
        },
      },
      {
        task: createDeepReasoningTask({
          taskId: 'desktop-five-slice-gate-reasoning',
          document,
          question: '保留什么约束？',
          depth: 'focused',
          instruction: '返回结构化结论。',
        }),
        expectedOutput: {
          format: 'structured',
          data: {
            answer: 'Keep the cold-light motif.',
            assumptions: ['The scene remains after the rain.'],
            alternatives: ['Change the motif to warm light.'],
            risks: ['A tonal shift may weaken continuity.'],
          },
        },
      },
      {
        task: createDistillationTask({
          taskId: 'desktop-five-slice-gate-distillation',
          document,
          target: 'project',
          fields: ['entities', 'events', 'promises'],
          instruction: '提取稳定事实。',
        }),
        expectedOutput: {
          format: 'structured',
          data: {
            summary: 'A character pauses after the rain.',
            entities: [{ id: 'gate-character', kind: 'character', name: '她' }],
            events: [{ id: 'gate-event', type: 'pause', description: 'She does not look back.' }],
            promises: [{ id: 'gate-promise', statement: 'The cold light remains.', status: 'open' }],
            confidence: 0.9,
          },
        },
      },
    ]
    const artifacts: Array<{ id: string; taskId: string; content: unknown }> = []
    let rewriteResult: Awaited<ReturnType<typeof first.assistant.runTask>>

    try {
      for (const item of cases) {
        const progress: TaskStatusSnapshot[] = []
        const result = await first.assistant.runTask(item.task, {
          pollIntervalMs: 10,
          onProgress: (snapshot) => progress.push(snapshot),
        })
        if (!result) throw new Error(`Expected result for ${item.task.id}`)
        if (item.task.kind === 'creative.rewrite') rewriteResult = result

        expect(result).toMatchObject({
          taskId: item.task.id,
          kind: item.task.kind,
          status: 'completed',
          output: item.expectedOutput,
          provenance: { fixture: 'desktop-five-slice-gate-harness' },
        })
        expect(result.output).toEqual(item.expectedOutput)
        expect(progress.map((snapshot) => snapshot.status)).toContain('completed')

        const persistedTask = await first.client.request<TaskStatusSnapshot>('task.status', {
          taskId: item.task.id,
        })
        expect(persistedTask).toMatchObject({
          taskId: item.task.id,
          kind: item.task.kind,
          status: 'completed',
          result: { output: item.expectedOutput },
        })

        if (item.task.outputContract?.persistence === 'artifact') {
          const artifactId = result.artifactIds?.[0]
          expect(artifactId).toEqual(expect.any(String))
          const artifact = await first.client.request<RuntimeArtifact>('artifact.get', { id: artifactId })
          expect(artifact).toMatchObject({
            id: artifactId,
            content: item.expectedOutput.data ?? item.expectedOutput.patch,
            provenance: expect.objectContaining({ taskId: item.task.id }),
          })
          artifacts.push({ id: artifactId!, taskId: item.task.id, content: artifact.content })
        } else {
          expect(result.artifactIds ?? []).toHaveLength(0)
        }
      }

      if (!rewriteResult) throw new Error('Expected rewrite result for proposal persistence')
      const proposalRemote = getProposalSyncRemote(rewriteResult)
      if (!proposalRemote) throw new Error('Expected the task result to carry proposal sync capability')

      const localProposals = new Map<string, AiProposal>()
      const localStore: ProposalStore = {
        list: async () => [...localProposals.values()],
        save: async (proposal) => {
          localProposals.set(proposal.id, proposal)
        },
      }
      const ledger = new ProposalLedger({
        store: new RemoteProposalStore({
          workspaceId,
          remote: proposalRemote,
          local: localStore,
        }),
      })
      await ledger.ready
      const proposal = proposalFromPatch(rewriteResult, {
        id: 'desktop-five-slice-gate-proposal',
        documentId: document.documentId,
        baseRevision: document.revision,
        sourceHash: hashText(document.text),
      })
      ledger.create(proposal)
      ledger.accept(proposal.id)
      const receipt = await ledger.commit(
        proposal.id,
        document.revision,
        (patches) => ({
          inversePatches: patches.map((patch) => ({
            documentId: patch.documentId,
            from: patch.from,
            to: patch.from + patch.text.length,
            text: document.text.slice(patch.from, patch.to),
          })),
        }),
        hashText(document.text),
      )
      await ledger.flush()
      expect(receipt).toMatchObject({
        proposalId: proposal.id,
        revision: document.revision + 1,
      })
      expect(localProposals.get(proposal.id)).toMatchObject({ status: 'committed' })
    } finally {
      await first.client.close()
    }

    const second = await connectClient()
    try {
      const proposalRemote = createDaemonProposalSyncRemote(second)
      for (const expected of artifacts) {
        const artifact = await second.request<RuntimeArtifact>('artifact.get', { id: expected.id })
        expect(artifact).toMatchObject({
          id: expected.id,
          content: expected.content,
          provenance: expect.objectContaining({ taskId: expected.taskId }),
        })
      }

      const proposalSnapshot = await proposalRemote.snapshotProposals(workspaceId)
      expect(proposalSnapshot.revision).toBeGreaterThan(0)
      expect(proposalSnapshot.proposals).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'desktop-five-slice-gate-proposal',
            status: 'committed',
            taskId: 'desktop-five-slice-gate-rewrite',
            patches: [
              expect.objectContaining({
                documentId: document.documentId,
                from: 0,
                to: 6,
                text: '雨停后只剩冷灯。',
              }),
            ],
          }),
        ]),
      )
    } finally {
      await second.close()
    }
  }, 45_000)
})

async function connectAssistant(): Promise<{ client: RpcClient; assistant: ReturnType<typeof createDaemonAiAssistant> }> {
  const client = await connectClient()
  return { client, assistant: createDaemonAiAssistant(client) }
}

async function connectClient(): Promise<RpcClient> {
  const testGlobal = globalThis as typeof globalThis & { WebSocket?: unknown }
  const browserWebSocket = testGlobal.WebSocket
  testGlobal.WebSocket = undefined
  try {
    return await inkpiDaemonGateway.connect(`ws://127.0.0.1:${daemon.wsPort}`)
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
      finishReject(new Error(`Timed out waiting for five-slice fixture. stdout=${stdout} stderr=${stderr}`))
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
          `Five-slice fixture exited before ready: code=${code ?? 'null'} signal=${signal ?? 'null'} stderr=${stderr}`,
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
