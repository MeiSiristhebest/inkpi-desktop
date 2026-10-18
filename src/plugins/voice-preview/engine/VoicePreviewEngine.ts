import type { RadioDramaScript, VoiceCastProfileRecord, VoiceGender, VoiceAgeGroup } from '../types'
import { extractQuotedSpeech } from '../../../domain/quotedSpeech'

export class VoicePreviewEngine {
  static extractScript(chapterText: string, characterNames: string[] = []): RadioDramaScript {
    const quotes = extractQuotedSpeech(chapterText, characterNames)
    return {
      totalLines: quotes.length,
      characterSpeakers: [
        ...new Set(quotes.flatMap((q) => (q.speakerName ? [q.speakerName] : []))),
      ],
      lines: quotes.map((quote, index) => ({
        lineIndex: index + 1,
        speakerName: quote.speakerName ?? '未归属说话人',
        dialogueText: quote.quote,
        emotion: 'unassigned',
        sourceStart: quote.start,
        sourceEnd: quote.end,
        attribution: quote.attribution,
        attributionStatus: quote.attributionStatus,
      })),
    }
  }
  static deriveDefaultProfile(
    characterName: string,
    gender: VoiceGender,
    ageGroup: VoiceAgeGroup,
  ): Omit<VoiceCastProfileRecord, 'id' | 'projectId' | 'characterId' | 'updatedAt'> {
    return { characterName, gender, ageGroup, pitch: 1, rate: 1, timbreFilter: 'standard' }
  }
  static validateProfile(profile: Pick<VoiceCastProfileRecord, 'pitch' | 'rate'>): void {
    if (
      !Number.isFinite(profile.pitch) ||
      !Number.isFinite(profile.rate) ||
      profile.pitch < 0 ||
      profile.pitch > 2 ||
      profile.rate < 0.5 ||
      profile.rate > 2
    )
      throw new Error('音调必须在 0–2、语速必须在 0.5–2 之间。')
  }
}
