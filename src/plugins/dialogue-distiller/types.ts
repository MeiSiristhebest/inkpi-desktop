import type {
  CharacterVoiceprint,
  ToneStyle,
  DialogueVoiceprintRepository,
} from '../../ports/dialogueVoiceprintRepository'
export type { CharacterVoiceprint, ToneStyle, DialogueVoiceprintRepository }
export interface VoiceprintVector {
  asl: number
  questionRatio: number
  exclamationRatio: number
  archaicRatio: number
  colloquialRatio: number
}
export interface SimilarityPair {
  charA: string
  charB: string
  similarity: number | null
  isHomogeneous?: never
  differences: { averageSentenceLength: number; questionRatio: number; exclamationRatio: number }
  advice: string
}
export interface DialoguePreset {
  id: string
  name: string
  description: string
  toneStyle: ToneStyle
  sampleSnippet: string
  typicalCatchphrases: string[]
}
