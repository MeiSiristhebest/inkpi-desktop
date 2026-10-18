import type { PluginContextFragment, PluginContextRequest } from '../../types/plugin'
import { indexedDbPowerTierRepository } from '../../adapters/indexedDbPowerTierRepository'
import { createProvenance } from '../../domain/story/provenance'
import { consistencyEngine } from './engine/ConsistencyEngine'

const RULE =
  'Use only recorded author constraints. Tier ordering does not prove a battle outcome. Verify scene time and abilities before asserting a conflict. A stored death state does not establish when a passage takes place.'

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
        id: `consistency:${request.projectId}:tiers:${authored.updatedAt}`,
        source: 'plugin.consistency-sentinel',
        kind: 'power-system-constraints',
        data: {
          powerSystemDefined: true,
          tiers: [...authored.tiers],
          relations: authored.relations ?? null,
          orderMode:
            authored.relations === undefined
              ? 'author-listed-linear-order'
              : 'explicit-partial-order',
          specialModifiers: [...authored.specialModifiers],
          validation: consistencyEngine.validatePowerHierarchy(authored),
          note: authored.provenance
            ? 'Preserve the stored provenance and its fact level.'
            : 'This legacy record has no authorship provenance; treat it as an unverified stored constraint.',
          rule: RULE,
        },
        metadata: {
          provenance:
            authored.provenance ??
            createProvenance({ sourceType: 'derived', factLevel: 'hypothesis' }),
        },
        priority: 700,
      }
    }

    return {
      id: `consistency:${request.projectId}:undefined`,
      source: 'plugin.consistency-sentinel',
      kind: 'power-system-constraints',
      data: {
        powerSystemDefined: false,
        rule: RULE,
        note: 'This workspace has no recorded power system. Do not supply a genre ladder or treat a preset as story canon; ask for author constraints before comparing tiers.',
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
