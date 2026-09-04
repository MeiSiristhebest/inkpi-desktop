// expectation-engine 领域模型与类型定义
import type { ExpectationContract } from '../../ports/expectationRepository'

export type { ExpectationContract }

export type EmotionalPointType =
  | 'conflict_escalate' // 矛盾激化
  | 'suppression'       // 遭受打压/陷入绝境
  | 'anticipation_seed' // 埋设期待/展示机缘
  | 'face_slap'         // 翻盘打脸
  | 'breakthrough'      // 境界/实力突破
  | 'treasure_claim'    // 夺得异宝/神级机缘
  | 'revelation'        // 揭秘/震动全场

export interface ChapterEmotionalScore {
  chapterIndex: number
  suppressionSum: number
  payoffSum: number
  spr: number // Suppression-to-Payoff Ratio: 压抑/释放比率
  riskLevel: 'healthy' | 'suppression_heavy' | 'fatigue_slap'
  dominantTags: string[]
}

export interface GoldenThreeDiagnostic {
  chapter1Status: {
    passed: boolean
    coreConflictFound: boolean
    goldenFingerFound: boolean
    feedback: string
  }
  chapter2Status: {
    passed: boolean
    escalationFound: boolean
    miniPayoffFound: boolean
    feedback: string
  }
  chapter3Status: {
    passed: boolean
    majorCrisisFound: boolean
    longHookFound: boolean
    feedback: string
  }
  overallScore: number
  advice: string
}
