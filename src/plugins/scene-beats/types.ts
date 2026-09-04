// 细纲节拍导演器 (scene-beats) 领域模型与类型定义

export type BeatType =
  | 'goal' // 目标动机（角色想要什么）
  | 'conflict' // 阻碍交锋（遇到的物理/人际阻力）
  | 'turning_point' // 意外转折（局面突变或新信息介入）
  | 'climax' // 爆点对抗（情绪或力量爆发最高点）
  | 'cliffhanger' // 章末悬念（留钩子吸引下章点击）

export interface SceneBeatItem {
  id: string
  chapterId: string
  order: number
  beatType: BeatType
  title: string
  goalOrConflict: string
  budgetWordRatio: number // 字数预算占比 (如 0.20, 0.35, 0.30, 0.15)
  emotionalIn: number // -1.0 ~ +1.0
  emotionalOut: number // -1.0 ~ +1.0
  isCompleted: boolean
  notes?: string
}

export interface ChapterBeatPlan {
  id: string
  projectId: string
  chapterId: string
  targetWordCount: number // 预期总字数，默认 3000
  beats: SceneBeatItem[]
  createdAt: number
  updatedAt: number
}

export interface BeatProgressReport {
  activeBeatIndex: number
  activeBeat?: SceneBeatItem
  targetTotalWords: number
  currentWords: number
  progressPct: number
  beatProgresses: Array<{
    beat: SceneBeatItem
    startWord: number
    endWord: number
    isPassed: boolean
  }>
}

export interface DramaticArcAnalysis {
  totalVoltageDelta: number
  isStagnant: boolean // 是否死水微澜 (ΔV < 0.3)
  curve: number[]
}
