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
  reason: string
}

export interface InformationAdvantage {
  characterA: string
  characterB: string
  advantageScore: number // -1 (B碾压A) 到 1 (A碾压B)
  knownByAOnly: string[]
  knownByBOnly: string[]
  mutualKnown: string[]
}
