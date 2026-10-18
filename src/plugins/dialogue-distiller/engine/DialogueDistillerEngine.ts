import { extractQuotedSpeech } from '../../../domain/quotedSpeech'
import type {
  CharacterVoiceprint,
  VoiceprintVector,
  SimilarityPair,
  DialoguePreset,
} from '../types'
const ARCHAIC_WORDS = ['尔等', '本座', '老夫', '此乃', '吾', '汝', '朕', '寡人']
const COLLOQUIAL_WORDS = ['俺', '老子', '哎呀', '没门', '得了吧', '扯淡']
const PRESETS: DialoguePreset[] = [
  {
    id: 'preset-formal',
    name: '正式表达示例',
    description: '可选措辞素材，人物口吻由作者决定。',
    toneStyle: 'archaic',
    sampleSnippet: '此事尚需核实。',
    typicalCatchphrases: [],
  },
  {
    id: 'preset-direct',
    name: '直接表达示例',
    description: '可选措辞素材，不能据此判断人物性格。',
    toneStyle: 'aggressive',
    sampleSnippet: '先回答我的问题。',
    typicalCatchphrases: [],
  },
  {
    id: 'preset-colloquial',
    name: '口语表达示例',
    description: '可选措辞素材。',
    toneStyle: 'colloquial',
    sampleSnippet: '这事咱们再想想。',
    typicalCatchphrases: [],
  },
  {
    id: 'preset-brief',
    name: '简短表达示例',
    description: '可选措辞素材。',
    toneStyle: 'laconic',
    sampleSnippet: '明天再来。',
    typicalCatchphrases: [],
  },
]
export interface QuoteEvidence {
  characterName: string
  quote: string
  start: number
  end: number
  attribution: string
}
export class DialogueDistillerEngine {
  extractQuoteEvidence(text: string, characterNames: string[]): QuoteEvidence[] {
    return extractQuotedSpeech(text, characterNames).flatMap((q) =>
      q.speakerName && characterNames.includes(q.speakerName)
        ? [
            {
              characterName: q.speakerName,
              quote: q.quote,
              start: q.start,
              end: q.end,
              attribution: q.attribution,
            },
          ]
        : [],
    )
  }
  extractCharacterQuotes(text: string, names: string[]): Record<string, string[]> {
    const result: Record<string, string[]> = Object.fromEntries(
      names.filter(Boolean).map((name) => [name, []]),
    )
    for (const evidence of this.extractQuoteEvidence(text, names))
      result[evidence.characterName].push(evidence.quote)
    return result
  }
  computeVoiceprint(
    characterName: string,
    quotes: string[],
    projectId = '',
  ): CharacterVoiceprint & { vector: VoiceprintVector } {
    const samples = quotes.filter((quote) => quote.trim())
    const sentences = samples.flatMap((quote) =>
      [...quote.matchAll(/[^。！？!?\r\n]+[。！？!?]*/g)]
        .filter((match) => match[0].replace(/[。！？!?]/g, '').trim())
        .map((match) => match[0]),
    )
    const count = sentences.length
    const average = count
      ? sentences.reduce(
          (total, sentence) => total + Array.from(sentence.replace(/[\s。！？!?]/g, '')).length,
          0,
        ) / count
      : 0
    const ratio = (predicate: (sentence: string) => boolean) =>
      count ? sentences.filter(predicate).length / count : 0
    const vector: VoiceprintVector = {
      asl: average,
      questionRatio: ratio((sentence) => /[？?]/.test(sentence)),
      exclamationRatio: ratio((sentence) => /[！!]/.test(sentence)),
      archaicRatio: ratio((sentence) => ARCHAIC_WORDS.some((word) => sentence.includes(word))),
      colloquialRatio: ratio((sentence) =>
        COLLOQUIAL_WORDS.some((word) => sentence.includes(word)),
      ),
    }
    return {
      id: projectId
        ? projectId + '::vp::' + encodeURIComponent(characterName)
        : 'vp-' + characterName,
      projectId,
      characterName,
      sampleDialogueCount: samples.length,
      sentenceCount: count,
      averageSentenceLength: average,
      questionRatio: vector.questionRatio,
      exclamationRatio: vector.exclamationRatio,
      catchphrases: [],
      toneStyle: 'custom',
      updatedAt: 0,
      vector,
    }
  }
  computeCosineSimilarity(vA: VoiceprintVector, vB: VoiceprintVector): number | null {
    const a = [vA.asl, vA.questionRatio, vA.exclamationRatio, vA.archaicRatio, vA.colloquialRatio]
    const b = [vB.asl, vB.questionRatio, vB.exclamationRatio, vB.archaicRatio, vB.colloquialRatio]
    if (![...a, ...b].every((value) => Number.isFinite(value) && value >= 0)) return null
    const normA = Math.hypot(...a),
      normB = Math.hypot(...b)
    if (normA === 0 || normB === 0) return null
    return Math.min(
      1,
      Math.max(0, a.reduce((dot, value, i) => dot + value * b[i], 0) / (normA * normB)),
    )
  }
  comparePair(
    charA: string,
    vA: VoiceprintVector,
    charB: string,
    vB: VoiceprintVector,
  ): SimilarityPair {
    const similarity = this.computeCosineSimilarity(vA, vB)
    return {
      charA,
      charB,
      similarity,
      differences: {
        averageSentenceLength: vA.asl - vB.asl,
        questionRatio: vA.questionRatio - vB.questionRatio,
        exclamationRatio: vA.exclamationRatio - vB.exclamationRatio,
      },
      advice:
        similarity === null
          ? '缺少可比较的样本。'
          : '这里只比较样本中的句长和标点比例；人物口吻需要结合语境审阅。',
    }
  }
  getPresets(): DialoguePreset[] {
    return PRESETS.map((preset) => ({
      ...preset,
      typicalCatchphrases: [...preset.typicalCatchphrases],
    }))
  }
}
export const dialogueDistillerEngine = new DialogueDistillerEngine()
