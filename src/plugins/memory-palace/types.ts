import type { EntityOccurrence } from '../../ports/memoryPalaceRepository'

export interface EntitySearchResult {
  entityId: string
  entityName: string
  category: string
  relevanceScore?: number
  aliases?: string[]
  matchKind?: 'exact_name' | 'exact_alias' | 'contains'
  occurrences?: EntityOccurrence[]
  matchedChapterCount?: number
  indexedChapterCount?: number
  totalOccurrences: number
  firstAppearedChapter?: {
    id: string
    title: string
    order?: number
  }
  lastAppearedChapter?: {
    id: string
    title: string
    order?: number
  }
  recentSnippets: string[]
}
