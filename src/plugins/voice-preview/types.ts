import type {
  VoiceGender,
  VoiceAgeGroup,
  VoiceTimbreFilter,
  VoiceCastProfileRecord,
} from "../../ports/voicePreviewRepository"

export type {
  VoiceGender,
  VoiceAgeGroup,
  VoiceTimbreFilter,
  VoiceCastProfileRecord,
}

export interface DialogueLine {
  lineIndex: number
  speakerName: string
  characterId?: string
  dialogueText: string
  emotion: "neutral" | "angry" | "cold" | "whisper" | "excited"
  assignedVoice?: {
    pitch: number
    rate: number
    timbreFilter: VoiceTimbreFilter
  }
}

export interface RadioDramaScript {
  totalLines: number
  characterSpeakers: string[]
  lines: DialogueLine[]
}

