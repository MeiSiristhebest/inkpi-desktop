import { endingCuts, reviewEnding } from '../../../domain/endingReview'
export class RhythmRadarEngine {
  static analyzeChapter(text: string, _chapterId: string, _chapterOrder: number) {
    return { ...reviewEnding(text), cuts: endingCuts(text) }
  }
}
