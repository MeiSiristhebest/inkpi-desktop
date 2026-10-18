import type {
  ChapterBeatPlan,
  SceneBeatItem,
  BeatProgressReport,
  DramaticArcAnalysis,
} from '../types'
export class SceneBeatsEngine {
  validatePlan(plan: ChapterBeatPlan): string[] {
    const errors: string[] = []
    if (!Number.isSafeInteger(plan.targetWordCount) || plan.targetWordCount <= 0)
      errors.push('总预算须为正整数。')
    const ids = new Set<string>(),
      orders = new Set<number>()
    for (const beat of plan.beats) {
      if (!beat.id.trim() || ids.has(beat.id)) errors.push('节拍 ID 缺失或重复。')
      if (!Number.isSafeInteger(beat.order) || beat.order < 0 || orders.has(beat.order))
        errors.push('节拍顺序无效或重复。')
      if (beat.chapterId !== plan.chapterId) errors.push('节拍与计划绑定的章节不一致。')
      if (
        !Number.isFinite(beat.budgetWordRatio) ||
        beat.budgetWordRatio < 0 ||
        beat.budgetWordRatio > 1
      )
        errors.push('预算占比须为 0 至 1 的有限数值。')
      for (const value of [beat.emotionalIn, beat.emotionalOut])
        if (value !== undefined && (!Number.isFinite(value) || value < -1 || value > 1))
          errors.push('作者情绪标注须在 -1 至 1 之间，未标注应留空。')
      ids.add(beat.id)
      orders.add(beat.order)
    }
    if (
      plan.beats.length &&
      Math.abs(plan.beats.reduce((sum, b) => sum + b.budgetWordRatio, 0) - 1) > 1e-9
    )
      errors.push('节拍占比之和须为 1；不会自动调整作者预算。')
    return [...new Set(errors)]
  }
  calculatePacingStatus(plan: ChapterBeatPlan, currentWordCount: number): BeatProgressReport {
    const errors = this.validatePlan(plan)
    if (!Number.isSafeInteger(currentWordCount) || currentWordCount < 0)
      errors.push('当前字符数须为非负整数。')
    if (errors.length) throw new Error(errors.join(' '))
    const beats = [...plan.beats].sort((a, b) => a.order - b.order)
    let accumulatedRatio = 0,
      previousEnd = 0,
      activeBeatIndex = -1
    const beatProgresses = beats.map((beat, index) => {
      const startWord = previousEnd
      accumulatedRatio += beat.budgetWordRatio
      const endWord =
        index === beats.length - 1
          ? plan.targetWordCount
          : Math.round(plan.targetWordCount * accumulatedRatio)
      previousEnd = endWord
      if (currentWordCount >= startWord && currentWordCount < endWord) activeBeatIndex = index
      return { beat, startWord, endWord, isPassed: currentWordCount >= endWord }
    })
    return {
      activeBeatIndex,
      activeBeat: beats[activeBeatIndex],
      targetTotalWords: plan.targetWordCount,
      currentWords: currentWordCount,
      progressPct: (currentWordCount / plan.targetWordCount) * 100,
      beatProgresses,
    }
  }
  evaluateDramaticArc(beats: SceneBeatItem[]): DramaticArcAnalysis {
    const sorted = [...beats].sort((a, b) => a.order - b.order)
    const curve = sorted.flatMap((beat) => [beat.emotionalIn ?? null, beat.emotionalOut ?? null])
    const complete =
      sorted.length > 0 &&
      curve.every((value) => value !== null && Number.isFinite(value) && value >= -1 && value <= 1)
    return {
      totalAnnotationChange: complete
        ? sorted.reduce((sum, b) => sum + Math.abs(b.emotionalOut! - b.emotionalIn!), 0)
        : null,
      curve,
      discontinuities: sorted.slice(1).flatMap((beat, index) => {
        const previous = sorted[index].emotionalOut
        return previous !== undefined &&
          beat.emotionalIn !== undefined &&
          previous !== beat.emotionalIn
          ? [
              {
                beforeBeatId: sorted[index].id,
                afterBeatId: beat.id,
                previousOut: previous,
                nextIn: beat.emotionalIn,
              },
            ]
          : []
      }),
    }
  }
  generatePresetPlan(
    templateId: 'climax_burst' | 'investigation' | 'transition',
    chapterId: string,
  ): SceneBeatItem[] {
    const templates = {
      climax_burst: [
        ['goal', '人物目标'],
        ['conflict', '行动阻碍'],
        ['climax', '关键选择'],
        ['cliffhanger', '后果与承接'],
      ],
      investigation: [
        ['goal', '调查问题'],
        ['turning_point', '新证据与解释'],
        ['cliffhanger', '尚待验证的问题'],
      ],
      transition: [
        ['goal', '当前状态'],
        ['turning_point', '变化或新目标'],
        ['cliffhanger', '下一步行动'],
      ],
    } as const
    return templates[templateId].map(([beatType, title], order) => ({
      id: 'beat-' + order + '-' + chapterId,
      chapterId,
      order,
      beatType,
      title,
      goalOrConflict: '',
      budgetWordRatio: 1 / templates[templateId].length,
      isCompleted: false,
    }))
  }
}
export const sceneBeatsEngine = new SceneBeatsEngine()
