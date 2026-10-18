import type {
  VoiceGender,
  VoiceAgeGroup,
  VoiceTimbreFilter,
  VoiceCastProfileRecord,
} from '../../ports/voicePreviewRepository'

export type { VoiceGender, VoiceAgeGroup, VoiceTimbreFilter, VoiceCastProfileRecord }

export interface DialogueLine {
  lineIndex: number
  speakerName: string
  characterId?: string
  dialogueText: string
  emotion: 'unassigned' | 'neutral' | 'angry' | 'cold' | 'whisper' | 'excited'
  sourceStart?: number
  sourceEnd?: number
  attribution?: string
  attributionStatus?: 'explicit' | 'unattributed' | 'author'
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
