import type { GoldOpeningDimension } from '../../../ports/goldChaptersRepository'
import type { GoldChaptersEvaluation } from '../types'

export const OPENING_DIMENSIONS: Record<GoldOpeningDimension, string> = {
  motivation: '动机词项',
  distinctive_asset: '筹码词项',
  conflict: '冲突词项',
  ending_hook: '结尾词项',
}

/** Locates literal vocabulary matches. It does not evaluate narrative quality or infer events. */
export class GoldChaptersEngine {
  public static buildAnalysisInput(chaptersText: string) {
    const snapshot = this.evaluate(chaptersText)
    return {
      sources: snapshot.ranges.map((range, index) => ({ id: `excerpt-${index}`, ...range })),
      coverage: {
        totalCharacters: snapshot.sourceLength,
        suppliedCharacters: snapshot.scannedCharacters,
        complete: snapshot.complete,
      },
      offsetUnit: 'UTF-16 code units; evidence offsets are relative to the named excerpt',
      rubric: Object.keys(OPENING_DIMENSIONS),
      responseContract: {
        findings: [
          {
            dimension: 'one of the rubric values',
            observation: 'what the supplied text explicitly says',
            interpretation: 'a contextual hypothesis, separate from the observation',
            recommendation: 'an optional revision for the author to consider',
            evidence: [{ sourceId: 'excerpt-0', start: 0, end: 2, quote: 'exact source text' }],
          },
        ],
        insufficientEvidence: ['questions that cannot be answered from the supplied excerpts'],
      },
    }
  }

  public static evaluate(chaptersText: string): GoldChaptersEvaluation {
    const sourceLength = chaptersText.length
    if (!chaptersText.trim()) {
      return {
        status: 'empty',
        sourceLength,
        scannedCharacters: 0,
        complete: false,
        ranges: [],
        observations: [],
      }
    }
    const openingEnd = Math.min(3000, sourceLength)
    const endingStart = Math.max(0, sourceLength - 500)
    const ranges =
      endingStart <= openingEnd
        ? [{ start: 0, end: sourceLength, text: chaptersText }]
        : [
            { start: 0, end: openingEnd, text: chaptersText.slice(0, openingEnd) },
            { start: endingStart, end: sourceLength, text: chaptersText.slice(endingStart) },
          ]
    const probes: Array<[GoldOpeningDimension, RegExp, number, number]> = [
      ['motivation', /(复仇|报仇|生存|活下去|救母|登顶|变强|退婚|洗清冤屈)/, 0, openingEnd],
      ['distinctive_asset', /(系统|金手指|面板|铜戒|穿越|觉醒|签到|残卷|古玉|神级)/, 0, openingEnd],
      ['conflict', /(欺凌|剥夺|杀意|逼迫|嘲弄|冷嘲热讽|生死战|危在旦夕)/, 0, openingEnd],
      ['ending_hook', /(原来|冷笑|这一次|誓要|天翻地覆|且看|竟是)/, endingStart, sourceLength],
    ]
    const observations: GoldChaptersEvaluation['observations'] = []
    for (const [dimension, pattern, start, end] of probes) {
      const match = pattern.exec(chaptersText.slice(start, end))
      if (match) {
        observations.push({
          dimension,
          start: start + match.index,
          end: start + match.index + match[0].length,
          quote: match[0],
        })
      }
    }
    const scannedCharacters = ranges.reduce((sum, range) => sum + range.end - range.start, 0)
    return {
      status: observations.length ? 'observed' : 'no-matches',
      sourceLength,
      scannedCharacters,
      complete: scannedCharacters === sourceLength,
      ranges,
      observations,
    }
  }
}
