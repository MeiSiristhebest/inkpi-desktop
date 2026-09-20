import { describe, expect, it, vi } from 'vitest'
import type { AiGateway, RpcClient } from '../ports/aiGateway'
import { connectToDaemon } from './daemonConnection'

function clientForHandshake(response: unknown): RpcClient & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    request: async <T>(method: string): Promise<T> => {
      calls.push(method)
      if (method === 'runtime.handshake') return response as T
      throw new Error(`Unexpected RPC method: ${method}`)
    },
    close: vi.fn(async () => undefined),
  }
}

describe('connectToDaemon Runtime compatibility gate', () => {
  it('fails closed and closes the socket when the Runtime rejects the contract', async () => {
    const client = clientForHandshake({
      accepted: false,
      protocolVersion: 'inkpi.runtime.v1',
      contractVersion: 1,
      schemaHash: '00000000',
      runtimeVersion: '1.0.0',
      capabilities: [],
      missingCapabilities: [],
      reason: 'Protocol, contract version, or schema hash mismatch',
    })
    const gateway: AiGateway = {
      connect: vi.fn(async () => client),
    }

    await expect(
      connectToDaemon(gateway, 'ws://127.0.0.1:8849', {
        isTauri: false,
        maxAttempts: 1,
      }),
    ).resolves.toEqual({ client: null, connected: false })

    expect(client.calls).toEqual(['runtime.handshake'])
    expect(client.close).toHaveBeenCalledTimes(1)
  })
})
