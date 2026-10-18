import type { AuthorEmotion, CompiledDialogueTrack, SubtextIntent } from '../types'
export class SubtextCompilerEngine {
  static compile(
    spoken: string,
    speakerName: string,
    emotion?: AuthorEmotion,
    intent: SubtextIntent = {},
  ): CompiledDialogueTrack {
    if (!spoken.trim() || !speakerName.trim()) throw new Error('填写实际说话人和台词。')
    return {
      speakerName,
      spoken,
      authorEmotion: emotion,
      goal: intent.goal ?? '',
      subtext: intent.intendedMeaning ?? '',
      beatAction: intent.action ?? '',
      relationship: intent.relationship ?? '',
      whyHidden: intent.whyHidden ?? '',
      status:
        intent.goal?.trim() && intent.intendedMeaning?.trim() ? 'author_draft' : 'needs_context',
    }
  }
  static renderNovelParagraph(track: CompiledDialogueTrack): string {
    return [track.beatAction, track.speakerName + '说：“' + track.spoken + '”']
      .filter((part) => part.trim())
      .join('\n')
  }
}
