import type { SkillManifest } from '@inkpi/protocol'
import { describe, expect, it, vi } from 'vitest'
import type { RpcClient } from '../ports/aiGateway'
import { createDaemonSkillRuntime } from './daemonSkillRuntime'

describe('createDaemonSkillRuntime', () => {
  it('maps the typed skill lifecycle to Runtime RPC methods', async () => {
    const requests: Array<{ method: string; params: unknown }> = []
    const client: RpcClient = {
      request: vi.fn(async <T>(method: string, params?: unknown): Promise<T> => {
        requests.push({ method, params })
        return { method, params } as T
      }),
      close: vi.fn(async () => undefined),
    }
    const runtime = createDaemonSkillRuntime(client)

    await runtime.discover()
    await runtime.resolve({ capability: 'continuity-audit' })
    await runtime.load('promise')
    await runtime.activate('promise')
    await runtime.status()

    expect(requests).toEqual([
      { method: 'skill.discover', params: undefined },
      { method: 'skill.resolve', params: { capability: 'continuity-audit' } },
      { method: 'skill.load', params: { skillId: 'promise' } },
      { method: 'skill.activate', params: { skillId: 'promise' } },
      { method: 'skill.status', params: undefined },
    ])
  })

  it('preserves the Runtime manifest shape without loading skill bodies', async () => {
    const manifest: SkillManifest = {
      id: 'promise',
      version: '1.0.0',
      title: 'Promise',
      description: 'Track promises.',
      activation: 'lazy',
    }
    const client: RpcClient = {
      request: vi.fn(async <T>(method: string): Promise<T> => {
        if (method === 'skill.discover') return [manifest] as T
        throw new Error(`Unexpected RPC method: ${method}`)
      }),
      close: vi.fn(async () => undefined),
    }

    await expect(createDaemonSkillRuntime(client).discover()).resolves.toEqual([manifest])
    expect(client.request).toHaveBeenCalledTimes(1)
  })
})
