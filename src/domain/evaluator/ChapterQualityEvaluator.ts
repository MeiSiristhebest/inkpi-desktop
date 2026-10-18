import { RhythmRadarEngine } from '../../plugins/rhythm-radar/engine/RhythmRadarEngine'
import { pluginEventBus } from '../../core/pluginEventBus'
import type { CutAlternative, EndingReview } from '../endingReview'
export interface ChapterQualityScoreResult {
  chapterId: string
  ending: EndingReview
  cuts: CutAlternative[]
  qualityStatus: 'not_assessed'
}
/** Aggregates source observations. Literary quality and platform outcomes are not inferred. */
export class ChapterQualityEvaluator {
  static evaluateChapter(params: {
    projectId: string
    chapterId: string
    chapterTitle: string
    chapterOrder: number
    content: string
  }): ChapterQualityScoreResult {
    const { cuts, ...ending } = RhythmRadarEngine.analyzeChapter(
      params.content,
      params.chapterId,
      params.chapterOrder,
    )
    pluginEventBus.emit('UNIFIED_CHAPTER_EVALUATED', {
      projectId: params.projectId,
      chapterId: params.chapterId,
      schemaVersion: 2,
      characterCount: ending.characters,
      observationCount: ending.observations.length,
      qualityStatus: 'not_assessed',
    })
    return { chapterId: params.chapterId, ending, cuts, qualityStatus: 'not_assessed' }
  }
}
