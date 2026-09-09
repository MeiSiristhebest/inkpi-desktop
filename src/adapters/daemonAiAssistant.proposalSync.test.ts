import type { AiTask, TaskResult } from '@inkpi/protocol'
import { describe, expect, it, vi } from 'vitest'
import { getProposalSyncRemote } from '../ai/proposals/remoteProposalStore'
import type { RpcClient } from '../ports/aiGateway'
import { createDaemonAiAssistant } from './daemonAiAssistant'

const rewriteTask: AiTask = {
  id: 'daemon-proposal-task',
  kind: 'creative.rewrite',
  input: { text: '原文' },
  outputContract: { format: 'patch' },
}

const rewriteResult: TaskResult = {
  taskId: rewriteTask.id,
  kind: rewriteTask.kind,
  status: 'completed',
  output: { format: 'patch', patch: { from: 0, to: 1, text: '改' } },
}

describe('daemon assistant proposal sync capability', () => {
  it('exposes the proposal remote and carries it through the existing task callback result', async () => {
    const request = vi.fn(async <T>(method: string, params?: unknown): Promise<T> => {
      if (method === 'instruction.register') return { success: true } as T
      if (method === 'task.submit') return { taskId: rewriteTask.id, status: 'queued' } as T
      if (method === 'task.status') {
        return {
          taskId: rewriteTask.id,
          kind: rewriteTask.kind,
          status: 'completed',
          result: rewriteResult,
        } as T
      }
      if (method === 'proposal.sync.snapshot') {
        return {
          workspaceId: 'workspace-1',
          revision: 0,
          proposals: [],
          hash: 'empty-snapshot',
          updatedAt: 0,
        } as T
      }
      if (method === 'proposal.sync.push') {
        return {
          accepted: true,
          duplicate: false,
          workspaceId: 'workspace-1',
          proposalId: 'proposal-1',
          revision: 1,
          stateHash: 'state-hash',
        } as T
      }
      throw new Error(`Unexpected RPC method: ${method} ${JSON.stringify(params)}`)
    })
    const client: RpcClient = { request, close: vi.fn(async () => undefined) }
    const assistant = createDaemonAiAssistant(client)

    const result = await assistant.runTask(rewriteTask, { pollIntervalMs: 0 })

    expect(assistant.proposalSyncRemote).toBeDefined()
    expect(getProposalSyncRemote(result)).toBe(assistant.proposalSyncRemote)
    expect(request.mock.calls.map(([method]) => method)).toEqual([
      'instruction.register',
      'task.submit',
      'task.status',
    ])
  })
})
