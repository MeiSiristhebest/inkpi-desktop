// sprint-arena 领域模型与类型定义
import type { SprintRecord } from '../../ports/sprintRepository'
import type { SynthesizerSoundType } from '../../ports/audioSynthesizer'

export type { SprintRecord, SynthesizerSoundType }

export type FlowStateLevel =
  | 'idle'       // 静止待命
  | 'warm_up'    // 微热蓄势 (Combo < 10)
  | 'focused'    // 渐入佳境 (Combo >= 10, WPM >= 30)
  | 'flow_surge' // 心流狂飙 (Combo >= 30, WPM >= 60)
  | 'zen_mode'   // 人键合一·心流化境 (Combo >= 60, WPM >= 80)

export interface SprintConfig {
  mode: 'time' | 'word_count'
  targetValue: number // 分钟数 (如 25) 或 目标字数 (如 1000)
  soundType: SynthesizerSoundType | 'none'
  volume: number
}

export interface WpmSamplePoint {
  timestamp: number
  wpm: number
}

export interface SprintProgress {
  isActive: boolean
  isFinished: boolean
  elapsedSeconds: number
  remainingSeconds?: number
  wordsWritten: number
  targetWords?: number
  currentWpm: number
  averageWpm: number
  peakWpm: number
  comboCount: number
  flowLevel: FlowStateLevel
}
