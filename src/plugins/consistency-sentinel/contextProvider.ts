import type { PluginContextFragment, PluginContextRequest } from '../../types/plugin'
import { indexedDbPowerTierRepository } from '../../adapters/indexedDbPowerTierRepository'
import { consistencyEngine } from './engine/ConsistencyEngine'

export async function provideConsistencyContext(
  request: PluginContextRequest,
): Promise<PluginContextFragment> {
  try {
    const system = (await indexedDbPowerTierRepository.get(request.projectId)) ||
      consistencyEngine.getDefaultSystem()
    return {
      id: `consistency:${request.projectId}:${system.tiers.join('|')}`,
      source: 'plugin.consistency-sentinel',
      kind: 'power-system-constraints',
      data: {
        tiers: [...system.tiers],
        rule: 'Ordered power tiers require explicit compensating cost for a breach; dead characters do not return without evidence.',
      },
      priority: 700,
    }
  } catch (error) {
    console.warn('[ConsistencySentinel] Failed to provide context:', error)
    return {
      id: `consistency:${request.projectId}:unavailable`,
      source: 'plugin.consistency-sentinel',
      kind: 'power-system-constraints',
      data: { unavailable: true },
      priority: 100,
    }
  }
}
