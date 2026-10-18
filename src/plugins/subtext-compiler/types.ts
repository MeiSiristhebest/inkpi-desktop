import type { SubtextDialogueRecord } from '../../ports/subtextRepository'
export type { SubtextDialogueRecord }
export type AuthorEmotion = 'anger' | 'fear' | 'pride' | 'affection' | 'jealousy' | 'guilt'
export interface SubtextIntent {
  goal?: string
  intendedMeaning?: string
  action?: string
  relationship?: string
  whyHidden?: string
}
export interface CompiledDialogueTrack {
  speakerName: string
  spoken: string
  authorEmotion?: AuthorEmotion
  goal: string
  subtext: string
  beatAction: string
  relationship: string
  whyHidden: string
  status: 'author_draft' | 'needs_context'
}
