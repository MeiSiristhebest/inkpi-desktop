import type { SubtextDialogueRecord } from "../../ports/subtextRepository"

export type { SubtextDialogueRecord }

export interface CompiledDialogueTrack {
  speakerName: string
  spoken: string // 表面台词
  subtext: string // 水下潜台词
  beatAction: string // 肢体微反应与停顿
  tensionLevel: number
  defenseMechanism: string
}
