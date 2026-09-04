import type { ScrapbookFragmentRecord } from "../../ports/scrapbookRepository"

export type { ScrapbookFragmentRecord }

export interface ScrapRecommendation {
  fragment: ScrapbookFragmentRecord
  similarityScore: number // 0.0 ~ 1.0
  matchedKeywords: string[]
}
