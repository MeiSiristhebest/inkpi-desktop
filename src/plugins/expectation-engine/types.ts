// expectation-engine 领域模型与类型定义
import type { ExpectationContract } from '../../ports/expectationRepository'

export type { ExpectationContract }

export type EmotionalPointType =
  | 'conflict_escalate' // 矛盾激化
  | 'suppression' // 遭受打压/陷入绝境
  | 'anticipation_seed' // 埋设期待/展示机缘
  | 'face_slap' // 翻盘打脸
  | 'breakthrough' // 境界/实力突破
  | 'treasure_claim' // 夺得异宝/神级机缘
  | 'revelation' // 揭秘/震动全场

export interface ChapterEmotionalScore {
  chapterIndex: number
  suppressionSum: number
  payoffSum: number
  spr: number | null
  dominantTags: string[]
  observations: ExpectationObservation[]
}

export interface ExpectationObservation {
  chapterIndex: number
  category: 'setup-term' | 'outcome-term' | 'ability-term' | 'question-term'
  quote: string
  startOffset: number
  endOffset: number
}

export interface GoldenThreeDiagnostic {
  observations: ExpectationObservation[]
  missingChapters: number[]
  advice: string
}
