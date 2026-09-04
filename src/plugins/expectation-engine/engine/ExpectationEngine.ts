import type {
  ChapterEmotionalScore,
  GoldenThreeDiagnostic,
  ExpectationContract,
} from '../types'

const SUPPRESSION_CUES = [
  '打压', '屈辱', '嘲讽', '绝境', '吐血', '危机', '围攻', '压制',
  '命悬一线', '退婚', '冷笑', '蝼蚁', '残废', '夺骨', '废物', '羞辱', '重伤', '被困'
]

const PAYOFF_CUES = [
  '突破', '斩杀', '震惊', '目瞪口呆', '悔恨', '暴毙', '臣服', '奉上',
  '神通大成', '打脸', '秒杀', '骇然', '不可思议', '狂喜', '倒吸一口凉气', '横扫', '翻盘'
]

const GOLDEN_FINGER_CUES = [
  '系统', '造化', '金手指', '古玉', '传承', '觉醒', '残魂', '神尊',
  '至尊骨', '重生', '异鼎', '戒指', '识海', '重修', '至宝', '至尊'
]

const HOOK_CUES = [
  '三年之约', '大比', '宗门', '秘境', '生死战', '黑手', '大劫',
  '迷雾', '杀父之仇', '深渊', '未解之谜', '誓杀', '惊天阴谋'
]

export class ExpectationEngine {
  /**
   * 连续张力梯度积分分析 (Continuous Tension Gradient Integral)：
   * 将长文本划分为 N 个段落分块 (Chunk)，计算情感正负梯度累积量。
   */
  public computeTensionIntegral(text: string): { suppressionArea: number; payoffArea: number; dynamicSpr: number } {
    if (!text || text.length < 50) return { suppressionArea: 0, payoffArea: 0, dynamicSpr: 1.0 }

    const paragraphs = text.split(/\n+/).map((p) => p.trim()).filter((p) => p.length > 5)
    if (paragraphs.length === 0) return { suppressionArea: 0, payoffArea: 0, dynamicSpr: 1.0 }

    let suppArea = 0
    let payArea = 0

    for (const p of paragraphs) {
      let suppWeight = 0
      let payWeight = 0

      for (const cue of SUPPRESSION_CUES) {
        if (p.includes(cue)) suppWeight += 1.0
      }
      for (const cue of PAYOFF_CUES) {
        if (p.includes(cue)) payWeight += 1.0
      }

      suppArea += suppWeight
      payArea += payWeight
    }

    const dynamicSpr = payArea > 0 ? Number((suppArea / payArea).toFixed(2)) : suppArea > 0 ? suppArea : 1.0
    return {
      suppressionArea: Math.round(suppArea * 10) / 10,
      payoffArea: Math.round(payArea * 10) / 10,
      dynamicSpr,
    }
  }

  /**
   * 计算压抑-释放比率 (SPR: Suppression to Payoff Ratio)
   */
  public calculateSPR(suppressionScore: number, payoffScore: number): number {
    if (payoffScore <= 0) {
      return suppressionScore > 0 ? Number(suppressionScore.toFixed(2)) : 1.0
    }
    return Number((suppressionScore / payoffScore).toFixed(2))
  }

  /**
   * 评估单章情绪与爽点压抑度
   */
  public evaluateChapterText(text: string, chapterIndex: number): ChapterEmotionalScore {
    let suppressionHits = 0
    let payoffHits = 0
    const dominantTags: string[] = []

    for (const cue of SUPPRESSION_CUES) {
      const count = (text.match(new RegExp(cue, 'g')) || []).length
      if (count > 0) {
        suppressionHits += count
        if (!dominantTags.includes('打压蓄势')) dominantTags.push('打压蓄势')
      }
    }

    for (const cue of PAYOFF_CUES) {
      const count = (text.match(new RegExp(cue, 'g')) || []).length
      if (count > 0) {
        payoffHits += count
        if (!dominantTags.includes('高能翻盘')) dominantTags.push('高能翻盘')
      }
    }

    const spr = this.calculateSPR(suppressionHits, payoffHits)

    let riskLevel: ChapterEmotionalScore['riskLevel'] = 'healthy'
    if (spr >= 3.5 && suppressionHits >= 4) {
      riskLevel = 'suppression_heavy' // 压抑过重，存在毒发弃书风险
    } else if (spr <= 0.4 && payoffHits >= 6) {
      riskLevel = 'fatigue_slap' // 爽点过密无阻力，易导致读者审美疲劳
    }

    return {
      chapterIndex,
      suppressionSum: suppressionHits,
      payoffSum: payoffHits,
      spr,
      riskLevel,
      dominantTags,
    }
  }

  /**
   * 黄金三章节奏自动化体检诊断
   */
  public diagnoseGoldenThree(
    ch1Text: string,
    ch2Text: string,
    ch3Text: string,
  ): GoldenThreeDiagnostic {
    // 第 1 章诊断：困境 + 金手指初现
    const c1Conflict = SUPPRESSION_CUES.some((cue) => ch1Text.includes(cue))
    const c1Cheat = GOLDEN_FINGER_CUES.some((cue) => ch1Text.includes(cue))
    const c1Passed = c1Conflict && c1Cheat
    const c1Feedback = c1Passed
      ? '开篇矛盾冲突清晰，且金手指/核心底牌及时显露，黄金开头标准。'
      : !c1Cheat
        ? '开篇缺少金手指或外挂机缘初现，读者缺乏对主角破局能力的期待。'
        : '主角缺少核心现实压迫困境，故事切入点偏平淡。'

    // 第 2 章诊断：矛盾升级 + 微型打脸立威
    const c2Escalate = SUPPRESSION_CUES.some((cue) => ch2Text.includes(cue))
    const c2Payoff = PAYOFF_CUES.some((cue) => ch2Text.includes(cue))
    const c2Passed = c2Escalate && c2Payoff
    const c2Feedback = c2Passed
      ? '矛盾在第二章有效升级，且完成了首个微观立威/爽点兑现。'
      : !c2Payoff
        ? '第二章持续遭难却无任何局部反击，存在拖沓憋屈风险。'
        : '第二章缺乏升级的外部阻力，爽点缺乏张力。'

    // 第 3 章诊断：主线大悬念/危机 + 中长期大钩子
    const c3Crisis = SUPPRESSION_CUES.some((cue) => ch3Text.includes(cue))
    const c3Hook = HOOK_CUES.some((cue) => ch3Text.includes(cue))
    const c3Passed = c3Crisis || c3Hook
    const c3Feedback = c3Passed
      ? '第三章成功展开主线危机并立下中长期悬念钩子，留存能力极高。'
      : '第三章未抛出核心主线悬念或生死倒计时大钩子，读者次日追读率可能受损。'

    let score = 50
    if (c1Passed) score += 20
    if (c2Passed) score += 15
    if (c3Passed) score += 15

    let advice = '黄金三章节奏良好，具备商业追读的基本张力与期待闭环。'
    if (score < 70) {
      advice = '黄金三章存在节奏硬伤：需警惕金手指展示过晚或前三章持续压抑无反弹的弃书点。'
    }

    return {
      chapter1Status: {
        passed: c1Passed,
        coreConflictFound: c1Conflict,
        goldenFingerFound: c1Cheat,
        feedback: c1Feedback,
      },
      chapter2Status: {
        passed: c2Passed,
        escalationFound: c2Escalate,
        miniPayoffFound: c2Payoff,
        feedback: c2Feedback,
      },
      chapter3Status: {
        passed: c3Passed,
        majorCrisisFound: c3Crisis,
        longHookFound: c3Hook,
        feedback: c3Feedback,
      },
      overallScore: score,
      advice,
    }
  }

  /**
   * 统计全书爽点契约闭环率与逾期契约
   */
  public auditContracts(contracts: ExpectationContract[], currentChapter: number) {
    const total = contracts.length
    const fulfilled = contracts.filter((c) => c.status === 'fulfilled').length
    const active = contracts.filter((c) => c.status === 'planted' || c.status === 'building' || c.status === 'climax')
    const overdue = active.filter((c) => c.promisedResolveChapter < currentChapter)

    const fulfillmentRate = total > 0 ? Math.round((fulfilled / total) * 100) : 100

    return {
      total,
      fulfilled,
      activeCount: active.length,
      overdueContracts: overdue,
      fulfillmentRate,
    }
  }
}

export const expectationEngine = new ExpectationEngine()
