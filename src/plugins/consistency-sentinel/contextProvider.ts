import type { PluginContextFragment, PluginContextRequest } from '../../types/plugin'
import { indexedDbPowerTierRepository } from '../../adapters/indexedDbPowerTierRepository'
import { createProvenance } from '../../domain/story/provenance'
import { consistencyEngine } from './engine/ConsistencyEngine'

const RULE =
  'Ordered power tiers require explicit compensating cost for a breach; dead characters do not return without evidence.'

/**
 * INV-05：只有作者确认过的力量体系才是事实。工作区没有记录时，内置修真阶梯只能作为
 * 明确标注的候选预设进入上下文；以高优先级注入会让模型把「练气→渡劫」当成这本西幻
 * 书的世界观去做一致性判定。体系一律按 request.projectId 从仓库读，引擎侧不留任何
 * 跨工作区可变缓存可读（INV-03）。
 */
export async function provideConsistencyContext(
  request: PluginContextRequest,
): Promise<PluginContextFragment> {
  try {
    const authored = await indexedDbPowerTierRepository.get(request.projectId)
    if (authored) {
      return {
        id: `consistency:${request.projectId}:tiers:${authored.tiers.join('|')}`,
        source: 'plugin.consistency-sentinel',
        kind: 'power-system-constraints',
        data: {
          powerSystemDefined: true,
          tiers: [...authored.tiers],
          rule: RULE,
        },
        metadata: {
          provenance:
            authored.provenance ??
            createProvenance({ sourceType: 'author', factLevel: 'canonical-fact' }),
        },
        priority: 700,
      }
    }

    const preset = consistencyEngine.getPresetSystems()[0]
    return {
      id: `consistency:${request.projectId}:preset:${preset.tiers.join('|')}`,
      source: 'plugin.consistency-sentinel',
      kind: 'power-system-constraints',
      data: {
        powerSystemDefined: false,
        candidateTiers: [...preset.tiers],
        rule: RULE,
        note: 'This workspace has no author-defined power system. The candidate ladder is a generic preset offered for reference only; never treat it as story canon and never report tier violations against it.',
      },
      metadata: {
        provenance: createProvenance({ sourceType: 'derived', factLevel: 'proposal' }),
      },
      priority: 200,
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
