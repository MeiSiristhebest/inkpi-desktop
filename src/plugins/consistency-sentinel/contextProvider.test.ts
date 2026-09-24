import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PowerTierSystem } from '../../ports/powerTierRepository'

const { getPowerTierSystem } = vi.hoisted(() => ({ getPowerTierSystem: vi.fn() }))

vi.mock('../../adapters/indexedDbPowerTierRepository', () => ({
  indexedDbPowerTierRepository: { get: getPowerTierSystem },
}))

import { consistencyEngine } from './engine/ConsistencyEngine'
import { provideConsistencyContext } from './contextProvider'

function system(overrides: Partial<PowerTierSystem> = {}): PowerTierSystem {
  return {
    projectId: 'ws-1',
    systemName: '星辰九境',
    tiers: ['星痕', '星徒', '星君'],
    specialModifiers: [],
    updatedAt: 1000,
    ...overrides,
  }
}

function payload(fragment: { data: unknown }): Record<string, unknown> {
  return fragment.data as Record<string, unknown>
}

beforeEach(() => {
  getPowerTierSystem.mockReset()
})

afterEach(() => {
  consistencyEngine.setCustomSystem(null)
})

describe('provideConsistencyContext', () => {
  it('injects an author-defined tier system as a canonical fact', async () => {
    getPowerTierSystem.mockResolvedValue(system())

    const fragment = await provideConsistencyContext({
      projectId: 'ws-1',
      currentText: '',
      activeChapterId: 'ch-1',
    })

    expect(getPowerTierSystem).toHaveBeenCalledWith('ws-1')
    expect(payload(fragment)).toEqual({
      powerSystemDefined: true,
      tiers: ['星痕', '星徒', '星君'],
      rule: expect.any(String),
    })
    expect(fragment.priority).toBe(700)
    expect(fragment.metadata).toEqual({
      provenance: expect.objectContaining({
        sourceType: 'author',
        factLevel: 'canonical-fact',
      }),
    })
  })

  it('keeps the provenance already recorded on the system instead of asserting authorship', async () => {
    getPowerTierSystem.mockResolvedValue(
      system({
        provenance: { sourceType: 'ai-extracted', factLevel: 'ai-inference' },
      }),
    )

    const fragment = await provideConsistencyContext({
      projectId: 'ws-1',
      currentText: '',
      activeChapterId: 'ch-1',
    })

    expect(fragment.metadata?.provenance).toEqual(
      expect.objectContaining({ sourceType: 'ai-extracted', factLevel: 'ai-inference' }),
    )
  })

  it('never presents the built-in cultivation ladder as a fact when the workspace has none', async () => {
    getPowerTierSystem.mockResolvedValue(null)

    const fragment = await provideConsistencyContext({
      projectId: 'ws-1',
      currentText: '',
      activeChapterId: 'ch-1',
    })
    const data = payload(fragment)

    expect(data.tiers).toBeUndefined()
    expect(data.powerSystemDefined).toBe(false)
    expect(data.candidateTiers).toEqual(consistencyEngine.getPresetSystems()[0].tiers)
    expect(String(data.note)).toMatch(/never treat it as story canon/i)
    expect(fragment.priority).toBeLessThan(700)
    expect(fragment.metadata?.provenance).toEqual(
      expect.objectContaining({ factLevel: 'proposal' }),
    )
  })

  it('does not leak another workspace cached as the engine custom system', async () => {
    consistencyEngine.setCustomSystem(system({ projectId: 'ws-2', tiers: ['青铜', '白银'] }))
    getPowerTierSystem.mockResolvedValue(null)

    const fragment = await provideConsistencyContext({
      projectId: 'ws-1',
      currentText: '',
      activeChapterId: 'ch-1',
    })

    expect(payload(fragment).candidateTiers).toEqual(consistencyEngine.getPresetSystems()[0].tiers)
    expect(payload(fragment).candidateTiers).not.toContain('白银')
  })

  it('degrades to an unavailable fragment rather than a fabricated world rule', async () => {
    getPowerTierSystem.mockRejectedValue(new Error('IndexedDB unavailable'))

    const fragment = await provideConsistencyContext({
      projectId: 'ws-1',
      currentText: '',
      activeChapterId: 'ch-1',
    })

    expect(payload(fragment)).toEqual({ unavailable: true })
    expect(fragment.priority).toBe(100)
  })
})
