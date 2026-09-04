import type {
  CharacterVoiceprint,
  ToneStyle,
  DialogueVoiceprintRepository,
} from '../../ports/dialogueVoiceprintRepository'

export type { CharacterVoiceprint, ToneStyle, DialogueVoiceprintRepository }

export interface VoiceprintVector {
  asl: number // 平均句长
  questionRatio: number // 反问诘问比
  exclamationRatio: number // 感叹祈使比
  archaicRatio: number // 文言古雅词比
  colloquialRatio: number // 白话口语比
}

export interface SimilarityPair {
  charA: string
  charB: string
  similarity: number // 0-1
  isHomogeneous: boolean // 相似度高于 85% 告警
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
