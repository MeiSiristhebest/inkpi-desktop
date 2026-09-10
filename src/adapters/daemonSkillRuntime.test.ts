import type { SkillManifest, SkillRuntimeRegistrationSnapshot } from '@inkpi/protocol'
import { describe, expect, it, vi } from 'vitest'
import type { RpcClient } from '../ports/aiGateway'
import { createDaemonSkillRuntime, FIRST_PARTY_SKILL_IDS } from './daemonSkillRuntime'

function snapshot(activatedSkills: string[] = []): SkillRuntimeRegistrationSnapshot {
  return {
    protocolVersion: 'skill-runtime.v1',
    skills: [],
    loadedSkills: [],
    activatedSkills,
    tools: [],
    tasks: [],
    contextProviders: [],
    extensionHost: {
      toolNames: [],
      commandNames: [],
      shortcutKeys: [],
      pipelineHookCount: 0,
    },
  }
}

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

  it('shares initialization, retries a failed activation, and never activates a skill twice', async () => {
    const requests: Array<{ method: string; params: unknown }> = []
    const activated = new Set<string>()
    let failPromiseActivation = true
    const client: RpcClient = {
      request: vi.fn(async <T>(method: string, params?: unknown): Promise<T> => {
        requests.push({ method, params })
        if (method === 'skill.status') return snapshot([...activated].sort()) as T
        if (method === 'skill.activate') {
          const skillId = (params as { skillId: string }).skillId
          if (skillId === 'promise' && failPromiseActivation) {
            failPromiseActivation = false
            throw new Error('promise activation failed')
          }
          activated.add(skillId)
          return {
            activated: true,
            loaded: true,
            skill: { id: skillId, version: '1.0.0' },
            snapshot: snapshot([...activated].sort()),
          } as T
        }
        throw new Error(`Unexpected RPC method: ${method}`)
      }),
      close: vi.fn(async () => undefined),
    }
    const runtime = createDaemonSkillRuntime(client)

    await expect(runtime.ensureFirstPartySkillsActivated()).rejects.toThrow(
      'promise activation failed',
    )

    const firstRetry = runtime.ensureFirstPartySkillsActivated()
    const concurrentRetry = runtime.ensureFirstPartySkillsActivated()
    const [firstSnapshot, concurrentSnapshot] = await Promise.all([firstRetry, concurrentRetry])
    const repeatedSnapshot = await runtime.ensureFirstPartySkillsActivated()

    expect(firstSnapshot).toEqual(concurrentSnapshot)
    expect(repeatedSnapshot).toEqual(firstSnapshot)
    expect([...activated].sort()).toEqual([...FIRST_PARTY_SKILL_IDS].sort())
    expect(requests.filter(({ method }) => method === 'skill.status')).toHaveLength(2)
    expect(
      requests
        .filter(({ method }) => method === 'skill.activate')
        .map(({ params }) => (params as { skillId: string }).skillId),
    ).toEqual(['hook', 'promise', 'promise', 'character-voice', 'timeline-consistency'])
  })
})
