import type { StoryState } from '../../domain/story'

export interface JitQueryInput {
  workspaceId: string
  currentDocumentId?: string
  currentDocumentText?: string
  selectionText?: string
  userPrompt?: string
  storyState?: StoryState
  activeReferences?: string[]
  maxKeywords?: number
  maxReferences?: number
}

export interface JitQueryResult {
  workspaceId: string
  currentDocumentId?: string
  currentText: string
  activeReferences: string[]
  keywords: string[]
  matchedEntityIds: string[]
  expandedEntityIds: string[]
  relevantPromiseIds: string[]
}

/**
 * 生产级 JIT Query Builder
 *
 * 职责：
 * 1. 扫描正文（当前段落/选区）、用户提示与现有 activeReferences；
 * 2. 匹配 StoryState 中的 entities（通过 name 和 aliases）；
 * 3. 沿关系网络进行 1-hop 扩散（如当前出现主角，则把其随身法宝、同门师尊纳入关联）；
 * 4. 聚合相关实体绑定的活跃伏笔（open promises）与前序事件；
 * 5. 生成精炼且去重的 activeReferences 与 ranked keywords，供 JIT 检索与模型注意力聚焦。
 */
export function buildJitQuery(input: JitQueryInput): JitQueryResult {
  const maxKeywords = input.maxKeywords ?? 8
  const maxReferences = input.maxReferences ?? 12
  const scanText = [
    input.userPrompt ?? '',
    input.selectionText ?? '',
    input.currentDocumentText ?? '',
    ...(input.activeReferences ?? []),
  ]
    .filter(Boolean)
    .join('\n')

  const matchedEntityIds = new Set<string>()
  const entityKeywords = new Set<string>()

  // 1. 扫描匹配 StoryState 实体
  if (input.storyState && input.storyState.entities) {
    for (const entity of Object.values(input.storyState.entities)) {
      let matched = false
      if (entity.name && scanText.includes(entity.name)) {
        matched = true
        entityKeywords.add(entity.name)
      }
      if (entity.aliases && Array.isArray(entity.aliases)) {
        for (const alias of entity.aliases) {
          if (alias && scanText.includes(alias)) {
            matched = true
            entityKeywords.add(alias)
          }
        }
      }
      if (matched) {
        matchedEntityIds.add(entity.id)
      }
    }
  }

  // 2. 1-hop 关系拓扑扩散
  const expandedEntityIds = new Set<string>()
  if (input.storyState && input.storyState.relations) {
    for (const relation of Object.values(input.storyState.relations)) {
      if (matchedEntityIds.has(relation.sourceEntityId)) {
        expandedEntityIds.add(relation.targetEntityId)
      } else if (matchedEntityIds.has(relation.targetEntityId)) {
        expandedEntityIds.add(relation.sourceEntityId)
      }
    }
  }

  // 3. 关联活跃伏笔（open promises）
  const relevantPromiseIds = new Set<string>()
  if (input.storyState && input.storyState.promises) {
    for (const promise of Object.values(input.storyState.promises)) {
      if (promise.status !== 'open') continue
      // 若伏笔的声明在文本中出现，或者伏笔关联的实体被捕获
      const mentioned = Boolean(promise.statement && scanText.includes(promise.statement))
      const relatedIds = (promise as unknown as { relatedEntityIds?: string[] }).relatedEntityIds
      const entityOverlap = Boolean(
        relatedIds &&
        relatedIds.some((id: string) => matchedEntityIds.has(id) || expandedEntityIds.has(id)),
      )
      if (mentioned || entityOverlap) {
        relevantPromiseIds.add(promise.id)
        if (promise.statement && promise.statement.length <= 15) {
          entityKeywords.add(promise.statement)
        }
      }
    }
  }

  // 4. 汇总 activeReferences
  const allEntityIds = new Set([...matchedEntityIds, ...expandedEntityIds])
  const activeReferenceLabels = new Set<string>(input.activeReferences ?? [])

  if (input.storyState && input.storyState.entities) {
    for (const id of allEntityIds) {
      const ent = input.storyState.entities[id]
      if (ent && ent.name) {
        activeReferenceLabels.add(ent.name)
      }
    }
  }

  // 5. 组装关键词（去重与排序）
  const keywords = Array.from(entityKeywords)
    .filter((k) => k.trim().length >= 2)
    .slice(0, maxKeywords)

  const activeReferences = Array.from(activeReferenceLabels)
    .filter((r) => r.trim().length > 0)
    .slice(0, maxReferences)

  const currentText = input.selectionText || input.currentDocumentText || ''

  return {
    workspaceId: input.workspaceId,
    currentDocumentId: input.currentDocumentId,
    currentText,
    activeReferences,
    keywords,
    matchedEntityIds: Array.from(matchedEntityIds),
    expandedEntityIds: Array.from(expandedEntityIds),
    relevantPromiseIds: Array.from(relevantPromiseIds),
  }
}
