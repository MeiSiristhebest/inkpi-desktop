import type { CycleBeatStatus, StagnationReport, CadencePhase, RhythmCadenceRecord } from '../types'

export class RhythmMetronomeEngine {
  static readonly DEFAULT_MICRO_LENGTH = 3
  static readonly DEFAULT_MESO_LENGTH = 15
  static readonly DEFAULT_MACRO_LENGTH = 50

  /** Biased sample ACF. A positive peak is a descriptive candidate, not a natural writing cycle. */
  static computeAutocorrelationPeriod(series: number[], maxLag = 10): number | null {
    if (
      series.length < 4 ||
      series.some((x) => !Number.isFinite(x)) ||
      !Number.isInteger(maxLag) ||
      maxLag < 2
    )
      return null
    const mean = series.reduce((a, b) => a + b, 0) / series.length
    const centered = series.map((x) => x - mean)
    const denominator = centered.reduce((sum, x) => sum + x * x, 0)
    if (!denominator) return null
    let bestLag: number | null = null
    let peak = 0
    for (let lag = 2; lag <= Math.min(maxLag, Math.floor(series.length / 2)); lag++) {
      const correlation =
        centered.slice(0, -lag).reduce((sum, x, i) => sum + x * centered[i + lag], 0) / denominator
      if (correlation > peak) {
        peak = correlation
        bestLag = lag
      }
    }
    return bestLag
  }

  static calculateBeats(
    totalChapters: number,
    config?: Partial<RhythmCadenceRecord>,
  ): { micro: CycleBeatStatus; meso: CycleBeatStatus; macro: CycleBeatStatus } {
    if (!Number.isSafeInteger(totalChapters) || totalChapters < 0)
      throw new RangeError('章节数必须是非负整数。')
    const resolve = (type: 'micro' | 'meso' | 'macro', length: number): CycleBeatStatus => {
      if (!Number.isSafeInteger(length) || length < 1)
        throw new RangeError('计划周期必须是正整数。')
      const step = totalChapters ? ((totalChapters - 1) % length) + 1 : 0
      const ratio = step / length
      const phase: CadencePhase =
        ratio === 1
          ? 'breather_reward'
          : ratio <= 0.34
            ? 'hook_plant'
            : ratio <= 0.67
              ? 'tension_escalation'
              : 'climax_payoff'
      const description =
        step === 0
          ? '尚无章节'
          : ratio === 1
            ? '计划周期末'
            : ratio <= 0.34
              ? '计划前段'
              : ratio <= 0.67
                ? '计划中段'
                : '计划后段'
      return {
        cycleType: type,
        cycleName:
          length + '章' + (type === 'micro' ? '短' : type === 'meso' ? '中' : '长') + '周期计划',
        totalSteps: length,
        currentStep: step,
        progressPct: Math.round(ratio * 100),
        phase,
        phaseDescription: description,
        recommendedAction: '对照作者的场景目标检查推进与停顿；周期位置不会规定情节内容。',
      }
    }
    return {
      micro: resolve('micro', config?.microCycleLength ?? 3),
      meso: resolve('meso', config?.mesoCycleLength ?? 15),
      macro: resolve('macro', config?.macroCycleLength ?? 50),
    }
  }

  static diagnoseStagnation(
    consecutiveStagnantChapters: number,
    lengths: number[],
  ): StagnationReport {
    if (
      !Number.isSafeInteger(consecutiveStagnantChapters) ||
      consecutiveStagnantChapters < 0 ||
      lengths.some((n) => !Number.isFinite(n) || n < 0)
    )
      throw new RangeError('标注章数与章节长度需要有效非负数。')
    const mean = lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : null
    const deviation =
      mean === null
        ? null
        : Math.sqrt(lengths.reduce((sum, n) => sum + (n - mean) ** 2, 0) / lengths.length)
    return {
      isStagnant: consecutiveStagnantChapters > 0,
      stagnantChapters: consecutiveStagnantChapters,
      sampleCount: lengths.length,
      averageCharacters: mean,
      coefficientOfVariation: mean && deviation !== null ? deviation / mean : null,
      diagnostic:
        '作者标注连续 ' +
        consecutiveStagnantChapters +
        ' 章未推进。章节长度只能描述篇幅，不能证明情节停滞、质量或读者耐心。',
      remedyAction: '对照这些章节的目标、变化与后果决定是否调整；平缓章节也可能承担必要功能。',
    }
  }

  static analyzeText(text: string) {
    const sentences = [...text.matchAll(/[^。！？!?\r\n]+[。！？!?]?/g)].flatMap((match) => {
      const quote = match[0].trim()
      if (!quote) return []
      const start = match.index! + match[0].indexOf(quote)
      return [{ start, end: start + quote.length, quote, characters: Array.from(quote).length }]
    })
    const lengths = sentences.map((sentence) => sentence.characters)
    return {
      sentences,
      sentenceCount: sentences.length,
      paragraphCount: text.split(/\r?\n/).filter((line) => line.trim()).length,
      averageSentenceCharacters: lengths.length
        ? lengths.reduce((a, b) => a + b, 0) / lengths.length
        : null,
      shortestSentence: lengths.length ? Math.min(...lengths) : null,
      longestSentence: lengths.length ? Math.max(...lengths) : null,
      punctuation: {
        comma: (text.match(/[，,]/g) ?? []).length,
        fullStop: (text.match(/[。.]/g) ?? []).length,
        question: (text.match(/[？?]/g) ?? []).length,
        exclamation: (text.match(/[！!]/g) ?? []).length,
      },
    }
  }
}
