import type { AuthorEmotionAnnotation, ChapterEmotionEvaluation, EmotionType } from '../types'
export const EMOTION_TYPES: EmotionType[] = [
  'tension',
  'catharsis',
  'frustration',
  'anticipation',
  'sorrow',
  'joy',
]
const CUES: Record<EmotionType, string[]> = {
  tension: ['危机', '紧绷', '杀意', '窒息'],
  catharsis: ['吐气扬眉', '突破', '登顶'],
  frustration: ['重伤', '绝望', '背叛'],
  anticipation: ['究竟', '倒计时', '谜底'],
  sorrow: ['悲恸', '泪水', '永别', '遗憾'],
  joy: ['喜悦', '欢呼', '团聚', '欣慰'],
}
export class EmotionCurveEngine {
  static evaluateChapter(params: {
    chapterId: string
    chapterTitle: string
    chapterOrder: number | null
    content: string
    annotation?: AuthorEmotionAnnotation
  }): ChapterEmotionEvaluation {
    const matches: ChapterEmotionEvaluation['matches'] = []
    for (const type of EMOTION_TYPES)
      for (const cue of CUES[type]) {
        let start = params.content.indexOf(cue)
        while (start >= 0) {
          matches.push({ type, quote: cue, start, end: start + cue.length })
          start = params.content.indexOf(cue, start + cue.length)
        }
      }
    const annotation = params.annotation
    if (annotation) {
      const values = Object.entries(annotation.values)
      if (
        !values.length ||
        values.some(
          ([type, value]) =>
            !EMOTION_TYPES.includes(type as EmotionType) ||
            !Number.isFinite(value) ||
            value < 0 ||
            value > 100,
        )
      )
        throw new Error('作者标注须至少填写一项 0 至 100 的有限数值；缺失维度保留未知。')
      if (
        !annotation.note.trim() ||
        !annotation.quote.trim() ||
        !Number.isSafeInteger(annotation.start) ||
        !Number.isSafeInteger(annotation.end) ||
        annotation.start < 0 ||
        annotation.end <= annotation.start ||
        annotation.end > params.content.length ||
        params.content.slice(annotation.start, annotation.end) !== annotation.quote
      )
        throw new Error('作者标注需要说明和匹配当前章节的精确原文区间。')
    }
    return {
      chapterId: params.chapterId,
      chapterTitle: params.chapterTitle,
      chapterOrder: params.chapterOrder,
      wordCount: Array.from(params.content.replace(/\s/g, '')).length,
      inputStatus: params.content.trim() ? 'provided' : 'empty',
      matches: matches.sort((a, b) => a.start - b.start),
      ...(annotation ? { annotation: { ...annotation, values: { ...annotation.values } } } : {}),
    }
  }
  /** An author-configured reminder about authored annotations, not reader fatigue. */
  static analyzeWindowFatigue(
    evaluations: ChapterEmotionEvaluation[],
    config?: { emotion: EmotionType; threshold: number; consecutive: number },
  ): string[] {
    if (!config) return []
    if (
      !EMOTION_TYPES.includes(config.emotion) ||
      !Number.isFinite(config.threshold) ||
      config.threshold < 0 ||
      config.threshold > 100 ||
      !Number.isSafeInteger(config.consecutive) ||
      config.consecutive < 2
    )
      throw new Error('作者提醒条件无效。')
    const ordered = evaluations
      .filter((e) => Number.isSafeInteger(e.chapterOrder) && e.chapterOrder! > 0)
      .sort((a, b) => a.chapterOrder! - b.chapterOrder!)
    if (new Set(ordered.map((e) => e.chapterOrder)).size !== ordered.length) return []
    const reminders: string[] = []
    let run = 0,
      previous: number | undefined
    for (const evaluation of ordered) {
      if (previous !== undefined && evaluation.chapterOrder !== previous + 1) run = 0
      const value = evaluation.annotation?.values[config.emotion]
      run = value !== undefined && value >= config.threshold ? run + 1 : 0
      if (run === config.consecutive)
        reminders.push(
          '第 ' +
            (evaluation.chapterOrder! - run + 1) +
            ' 至 ' +
            evaluation.chapterOrder +
            ' 章连续满足作者的 ' +
            config.emotion +
            ' 标注提醒条件；读者反应未知。',
        )
      previous = evaluation.chapterOrder!
    }
    return reminders
  }
}
