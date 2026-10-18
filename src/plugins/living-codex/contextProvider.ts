import type { PluginContextFragment, PluginContextRequest } from '../../types/plugin'
import { indexedDbCodexEntityRepository } from '../../adapters/indexedDbCodexEntityRepository'
import { CodexGraphStore } from './engine/GraphStore'

export async function provideLivingCodexContext(
  request: PluginContextRequest,
): Promise<PluginContextFragment | null> {
  try {
    const entities = (await indexedDbCodexEntityRepository.getAll()).filter(
      (entity) => entity.projectId === request.projectId,
    )
    if (entities.length === 0) return null

    const store = new CodexGraphStore()
    store.updateDataset(entities)
    const { matchedEntities, totalEstimatedTokens, budgetKind } = store.resolveContextSlice(
      request.currentText,
      1000,
    )
    if (matchedEntities.length === 0) return null

    return {
      id: `codex:${request.projectId}:${matchedEntities.map((entity) => entity.id).join('|')}`,
      source: 'plugin.living-codex',
      kind: 'codex-entities',
      data: {
        entities: matchedEntities.map((entity) => ({
          id: entity.id,
          name: entity.name,
          aliases: entity.aliases,
          category: entity.category,
          summary: entity.summary,
          attributes: entity.attributes,
          relations: entity.relations,
          updatedAt: entity.updatedAt,
        })),
      },
      priority: 750,
      metadata: {
        provenance: 'author-codex-records',
        totalEstimatedTokens,
        budgetKind,
        selectionMethod: 'literal-names-and-one-hop-author-relations',
        budgetBasis: 'formatted-context-character-estimate',
      },
    }
  } catch (error) {
    console.warn('[LivingCodex] Failed to provide context:', error)
    return null
  }
}
