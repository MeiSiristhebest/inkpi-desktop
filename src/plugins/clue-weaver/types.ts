import type {
  ClueItem,
  ClueCognitionRecord,
  EpistemicState,
  ClueWeaverData,
} from '../../ports/clueWeaverRepository'

export type { ClueItem, ClueCognitionRecord, EpistemicState, ClueWeaverData }

export interface GodViewViolation {
  characterName: string
  characterId: string
  clueId: string
  clueTitle: string
  matchedKeyword: string
  snippet: string
  startOffset: number
  endOffset: number
  status: 'candidate'
  chapterNumber?: number
  reason: string
}

export interface InformationAdvantage {
  characterA: string
  characterB: string
  advantageScore: number | null // Count ratio of declared known sets; no tactical advantage is inferred.
  unrecordedPairs: number
  knownByAOnly: string[]
  knownByBOnly: string[]
  mutualKnown: string[]
}
