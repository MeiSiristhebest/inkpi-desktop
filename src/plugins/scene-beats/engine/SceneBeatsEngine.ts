// 细纲节拍导演器核心算法引擎
// 单章微观戏剧电容、字数预算区间映射、情绪势能反转分析与经典模型生成

import type {
  ChapterBeatPlan,
  SceneBeatItem,
  BeatProgressReport,
  DramaticArcAnalysis,
} from '../types'

export class SceneBeatsEngine {
  /**
   * 根据当前正文字数，计算当前写作所处的节拍索引与各节拍进度区间
   */
  public calculatePacingStatus(
    plan: ChapterBeatPlan,
    currentWordCount: number,
  ): BeatProgressReport {
    const beats = [...plan.beats].sort((a, b) => a.order - b.order)
    const targetTotal = Math.max(100, plan.targetWordCount || 3000)

    let accumulatedWords = 0
    const beatProgresses: BeatProgressReport['beatProgresses'] = []
    let activeBeatIndex = 0

    for (let i = 0; i < beats.length; i++) {
      const beat = beats[i]
      const ratio = beat.budgetWordRatio > 0 ? beat.budgetWordRatio : 1 / Math.max(1, beats.length)
      const beatWords = Math.round(targetTotal * ratio)

      const startWord = accumulatedWords
      const endWord = i === beats.length - 1 ? targetTotal : accumulatedWords + beatWords
      accumulatedWords = endWord

      const isPassed = currentWordCount >= endWord
      if (currentWordCount >= startWord && currentWordCount < endWord) {
        activeBeatIndex = i
      } else if (currentWordCount >= targetTotal && i === beats.length - 1) {
        activeBeatIndex = i
      }

      beatProgresses.push({
        beat,
        startWord,
        endWord,
        isPassed,
      })
    }

    return {
      activeBeatIndex,
      activeBeat: beats[activeBeatIndex],
      targetTotalWords: targetTotal,
      currentWords: currentWordCount,
      progressPct: Math.min(100, Math.round((currentWordCount / targetTotal) * 100)),
      beatProgresses,
    }
  }

  /**
   * 计算整章戏剧势能落差与张力走势
   * 情绪势能总跨度 ΔV = Σ |emotionalOut - emotionalIn|
   */
  public evaluateDramaticArc(beats: SceneBeatItem[]): DramaticArcAnalysis {
    if (beats.length === 0) {
      return { totalVoltageDelta: 0, isStagnant: true, curve: [0] }
    }

    const sorted = [...beats].sort((a, b) => a.order - b.order)
    let totalDelta = 0
    const curve: number[] = [sorted[0].emotionalIn]

    for (const b of sorted) {
      const delta = Math.abs(b.emotionalOut - b.emotionalIn)
      totalDelta += delta
      curve.push(b.emotionalOut)
    }

    // 格式化精度
    const finalDelta = Number(totalDelta.toFixed(2))

    return {
      totalVoltageDelta: finalDelta,
      isStagnant: finalDelta < 0.4, // 若全章起伏极小，视为死水微澜
      curve,
    }
  }

  /**
   * 预置经典节拍模板工厂
   */
  public generatePresetPlan(
    templateId: 'climax_burst' | 'investigation' | 'transition',
    chapterId: string,
  ): SceneBeatItem[] {
    if (templateId === 'climax_burst') {
      return [
        {
          id: `beat-1-${chapterId}`,
          chapterId,
          order: 0,
          beatType: 'goal',
          title: '动机切入与风暴前夕',
          goalOrConflict: '主角踏入决战险地，杀气锁定，目标明确',
          budgetWordRatio: 0.15,
          emotionalIn: 0.1,
          emotionalOut: -0.3,
          isCompleted: false,
        },
        {
          id: `beat-2-${chapterId}`,
          chapterId,
          order: 1,
          beatType: 'conflict',
          title: '强敌骤现，试探交锋',
          goalOrConflict: '反派底牌层出，主角落入下风被逼入死角',
          budgetWordRatio: 0.35,
          emotionalIn: -0.3,
          emotionalOut: -0.8,
          isCompleted: false,
        },
        {
          id: `beat-3-${chapterId}`,
          chapterId,
          order: 2,
          beatType: 'climax',
          title: '祭出底牌，绝地反杀',
          goalOrConflict: '突破生死关头，神通爆发，一举碾压定乾坤',
          budgetWordRatio: 0.35,
          emotionalIn: -0.8,
          emotionalOut: 0.9,
          isCompleted: false,
        },
        {
          id: `beat-4-${chapterId}`,
          chapterId,
          order: 3,
          beatType: 'cliffhanger',
          title: '余波震荡，章末留钩',
          goalOrConflict: '搜刮战利品突生异变，引出更大黑手线索',
          budgetWordRatio: 0.15,
          emotionalIn: 0.9,
          emotionalOut: 0.4,
          isCompleted: false,
        },
      ]
    }

    if (templateId === 'investigation') {
      return [
        {
          id: `beat-1-${chapterId}`,
          chapterId,
          order: 0,
          beatType: 'goal',
          title: '异象初显，循迹追踪',
          goalOrConflict: '拍卖会或密林偶遇残卷，决心查清身世真相',
          budgetWordRatio: 0.25,
          emotionalIn: 0.0,
          emotionalOut: 0.2,
          isCompleted: false,
        },
        {
          id: `beat-2-${chapterId}`,
          chapterId,
          order: 1,
          beatType: 'turning_point',
          title: '暗流涌动，突遭灭口',
          goalOrConflict: '线人被杀，现场留下指向宗门长老的血迹',
          budgetWordRatio: 0.35,
          emotionalIn: 0.2,
          emotionalOut: -0.6,
          isCompleted: false,
        },
        {
          id: `beat-3-${chapterId}`,
          chapterId,
          order: 2,
          beatType: 'cliffhanger',
          title: '步入死局，危局待破',
          goalOrConflict: '执法堂包围客栈，主角被迫隐匿身份突围',
          budgetWordRatio: 0.4,
          emotionalIn: -0.6,
          emotionalOut: -0.4,
          isCompleted: false,
        },
      ]
    }

    // transition 缓冲过渡
    return [
      {
        id: `beat-1-${chapterId}`,
        chapterId,
        order: 0,
        beatType: 'goal',
        title: '战后盘点，闭关疗伤',
        goalOrConflict: '清点战利品，炼化灵丹稳固境界道基',
        budgetWordRatio: 0.4,
        emotionalIn: 0.2,
        emotionalOut: 0.5,
        isCompleted: false,
      },
      {
        id: `beat-2-${chapterId}`,
        chapterId,
        order: 1,
        beatType: 'turning_point',
        title: '偶获机缘，道心领悟',
        goalOrConflict: '与同伴交流或感悟天地，实力更上一层楼',
        budgetWordRatio: 0.35,
        emotionalIn: 0.5,
        emotionalOut: 0.8,
        isCompleted: false,
      },
      {
        id: `beat-3-${chapterId}`,
        chapterId,
        order: 2,
        beatType: 'cliffhanger',
        title: '风起云涌，启程新局',
        goalOrConflict: '远方传来秘境现世消息，动身出发',
        budgetWordRatio: 0.25,
        emotionalIn: 0.8,
        emotionalOut: 0.6,
        isCompleted: false,
      },
    ]
  }
}

export const sceneBeatsEngine = new SceneBeatsEngine()
