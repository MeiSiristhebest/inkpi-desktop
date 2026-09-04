export interface EntitySearchResult {
  entityId: string
  entityName: string
  category: string
  relevanceScore: number
  totalOccurrences: number
  firstAppearedChapter?: {
    id: string
    title: string
    order: number
  }
  lastAppearedChapter?: {
    id: string
    title: string
    order: number
  }
  recentSnippets: string[]
}
