import type { EntitySearchResult } from '../types'
import type { CodexEntity } from '../../living-codex/types'
import type { ChapterRecord } from '../../../types'

export class MemoryPalaceEngine {
  /**
   * 建立长篇小说跨章实体倒排索引，并快速召回特定实体的历史登场轨迹
   */
  static searchEntityOccurrences(params: {
    query: string
    entities: CodexEntity[]
    chapters: ChapterRecord[]
  }): EntitySearchResult[] {
    const { query, entities, chapters } = params
    const trimmedQuery = query.trim().toLowerCase()

    // 章节按顺序排序
    const sortedChapters = [...chapters].sort((a, b) => a.order - b.order)

    // 匹配候选实体
    const matchedEntities = entities.filter((e) => {
      if (!trimmedQuery) return true
      const nameMatch = e.name.toLowerCase().includes(trimmedQuery)
      const aliasMatch = e.aliases?.some((a: string) => a.toLowerCase().includes(trimmedQuery))
      const descMatch = e.summary?.toLowerCase().includes(trimmedQuery)
      return nameMatch || aliasMatch || descMatch
    })

    const results: EntitySearchResult[] = []

    for (const ent of matchedEntities) {
      const searchTerms = [ent.name, ...(ent.aliases || [])].filter(Boolean)
      const occurrences: { chapter: ChapterRecord; snippet: string }[] = []

      for (const ch of sortedChapters) {
        const text = ch.content || ''
        if (!text) continue

        for (const term of searchTerms) {
          const idx = text.indexOf(term)
          if (idx !== -1) {
            // 提取上下文摘要 (前后 35 字)
            const start = Math.max(0, idx - 30)
            const end = Math.min(text.length, idx + term.length + 30)
            const snippet = (start > 0 ? '...' : '') + text.slice(start, end).replace(/\n/g, ' ') + (end < text.length ? '...' : '')
            occurrences.push({ chapter: ch, snippet })
            break // 该章已命中，避免同一章因多别名重复记录
          }
        }
      }

      const totalOccurrences = occurrences.length
      const firstOcc = occurrences[0]
      const lastOcc = occurrences[occurrences.length - 1]

      // 提取最新登场的几条摘要
      const recentSnippets = occurrences.slice(-3).map((o) => `[第${o.chapter.order}章 ${o.chapter.title}] ${o.snippet}`)

      // 计算相关度评分
      let relevanceScore = 50
      if (ent.name.toLowerCase() === trimmedQuery) {
        relevanceScore = 100
      } else if (ent.name.toLowerCase().includes(trimmedQuery)) {
        relevanceScore = 85
      } else if (ent.aliases?.some((a: string) => a.toLowerCase() === trimmedQuery)) {
        relevanceScore = 90
      }

      results.push({
        entityId: ent.id,
        entityName: ent.name,
        category: ent.category,
        relevanceScore,
        totalOccurrences,
        firstAppearedChapter: firstOcc
          ? { id: firstOcc.chapter.id, title: firstOcc.chapter.title, order: firstOcc.chapter.order }
          : undefined,
        lastAppearedChapter: lastOcc
          ? { id: lastOcc.chapter.id, title: lastOcc.chapter.title, order: lastOcc.chapter.order }
          : undefined,
        recentSnippets,
      })
    }

    // 按相关度与出现频次降序
    results.sort((a, b) => b.relevanceScore - a.relevanceScore || b.totalOccurrences - a.totalOccurrences)
    return results
  }

  /**
   * 自动探测当前章节正文中提到的历史实体（辅助免打扰即时召回）
   */
  static detectEntitiesInText(text: string, entities: CodexEntity[]): CodexEntity[] {
    if (!text) return []
    const detected: CodexEntity[] = []

    for (const ent of entities) {
      const terms = [ent.name, ...(ent.aliases || [])].filter(Boolean)
      const found = terms.some((t) => text.includes(t))
      if (found) {
        detected.push(ent)
      }
    }

    return detected
  }
}
