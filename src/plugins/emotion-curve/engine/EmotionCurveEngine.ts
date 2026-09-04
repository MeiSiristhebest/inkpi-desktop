import type { EmotionVector, ChapterEmotionEvaluation, EmotionType } from '../types'

export class EmotionCurveEngine {
  /**
   * 细粒度六维情绪特征词汇图谱
   */
  private static readonly EMOTION_LEXICON: Record<EmotionType, string[]> = {
    tension: [
      '危机', '杀意', '窒息', '压迫', '紧绷', '倒吸一口凉气', '惊骇', '千钧一发',
      '瞳孔骤缩', '心头巨震', '死寂', '轰然', '剧变', '撕裂', '暴怒', '恐怖'
    ],
    catharsis: [
      '暴爽', '碾压', '秒杀', '一剑破万法', '吐气扬眉', '倒下', '跪伏', '震撼',
      '俯瞰', '神王', '突破', '名震八荒', '狂笑', '诛灭', '登顶', '天下第一'
    ],
    frustration: [
      '重伤', '被辱', '封印', '狼狈', '吐血', '绝望', '夺走', '背叛',
      '嘲讽', '蝼蚁', '残废', '囚禁', '受制于人', '无力回天', '咬牙切齿'
    ],
    anticipation: [
      '究竟', '到底', '倒计时', '下一刻', '谜底', '传承', '宝藏', '那是……',
      '等待着', '究竟是谁', '暗流涌动', '契约', '揭秘', '机缘', '异动'
    ],
    sorrow: [
      '陨落', '悲恸', '泪水', '永别', '残阳', '枯骨', '萧索', '祭奠',
      '遗憾', '化为灰烬', '悲凉', '叹息', '孤独', '惨烈'
    ],
    joy: [
      '大笑', '欢呼', '庆功', '喜悦', '收获', '美酒', '团聚', '融洽',
      '心满意足', '春风得意', '欣慰', '温馨', '神采飞扬'
    ],
  }

  /**
   * 分析单个章节的读者情绪向量与极性振幅
   */
  static evaluateChapter(params: {
    chapterId: string
    chapterTitle: string
    chapterOrder: number
    content: string
  }): ChapterEmotionEvaluation {
    const { chapterId, chapterTitle, chapterOrder, content } = params
    const wordCount = content.replace(/\s+/g, '').length

    if (!content || wordCount < 30) {
      const zeroVec: EmotionVector = {
        tension: 10,
        catharsis: 10,
        frustration: 10,
        anticipation: 10,
        sorrow: 10,
        joy: 10,
      }
      return {
        chapterId,
        chapterTitle,
        chapterOrder,
        wordCount,
        vector: zeroVec,
        netPolarity: 0,
        dominantEmotion: 'anticipation',
        resonanceScore: 20,
        warnings: ['章节正文字数过少，无法形成有效读者情绪波浪。'],
        suggestions: ['补充具体情节冲突与感官细节描写。'],
      }
    }

    // 1. 统计六维频次
    const counts: Record<EmotionType, number> = {
      tension: 0,
      catharsis: 0,
      frustration: 0,
      anticipation: 0,
      sorrow: 0,
      joy: 0,
    }

    const types: EmotionType[] = ['tension', 'catharsis', 'frustration', 'anticipation', 'sorrow', 'joy']
    for (const t of types) {
      for (const kw of this.EMOTION_LEXICON[t]) {
        let pos = 0
        while ((pos = content.indexOf(kw, pos)) !== -1) {
          counts[t] += 1
          pos += kw.length
        }
      }
    }

    // 归一化评分 (基准 15，按命中数平滑递增至 100)
    const vector: EmotionVector = {
      tension: Math.min(100, Math.round(15 + counts.tension * 8)),
      catharsis: Math.min(100, Math.round(15 + counts.catharsis * 8)),
      frustration: Math.min(100, Math.round(15 + counts.frustration * 8)),
      anticipation: Math.min(100, Math.round(15 + counts.anticipation * 8)),
      sorrow: Math.min(100, Math.round(15 + counts.sorrow * 8)),
      joy: Math.min(100, Math.round(15 + counts.joy * 8)),
    }

    // 2. 主导情绪判定
    let dominantEmotion: EmotionType = 'tension'
    let maxVal = -1
    for (const t of types) {
      if (vector[t] > maxVal) {
        maxVal = vector[t]
        dominantEmotion = t
      }
    }

    // 3. 净情绪极性 (Net Emotional Polarity): [-100, 100]
    // 积极代偿 = 0.40 catharsis + 0.35 joy + 0.25 anticipation
    // 消极蓄势 = 0.40 frustration + 0.35 tension + 0.25 sorrow
    const positiveScore = 0.40 * vector.catharsis + 0.35 * vector.joy + 0.25 * vector.anticipation
    const negativeScore = 0.40 * vector.frustration + 0.35 * vector.tension + 0.25 * vector.sorrow
    const netPolarity = Math.max(-100, Math.min(100, Math.round(positiveScore - negativeScore)))

    // 4. 代入共鸣深度 (Resonance Score: 0 - 100)
    const rawResonance = (vector.tension * 0.25 + vector.catharsis * 0.35 + vector.anticipation * 0.25 + vector.frustration * 0.15)
    const resonanceScore = Math.max(10, Math.min(100, Math.round(rawResonance)))

    // 5. 警报与建议
    const warnings: string[] = []
    const suggestions: string[] = []

    if (Math.abs(netPolarity) < 8 && resonanceScore < 30) {
      warnings.push('⚠️ 情绪心电图过平：当前章缺乏明显起伏与冲突张力，易使读者产生阅读困倦。')
      suggestions.push('建议在章中注入“突发异数”或制造“认知反差”以唤醒情绪波澜。')
    } else if (netPolarity < -35) {
      warnings.push('📉 深度蓄势/高压打压区：读者情绪处于沉重受挫状态，注意不要连续多章保持该状态。')
      suggestions.push('下章必须安排核心反击契机或局部爽点释放，防止读者抑郁弃书。')
    } else if (netPolarity > 45) {
      suggestions.push('🔥 情绪巅峰释放：大爽点/关键突破已兑现，建议随后适当引入后续宏观隐患。')
    }

    return {
      chapterId,
      chapterTitle,
      chapterOrder,
      wordCount,
      vector,
      netPolarity,
      dominantEmotion,
      resonanceScore,
      warnings,
      suggestions,
    }
  }

  /**
   * 滑动窗口多章情绪波浪疲劳度分析
   */
  static analyzeWindowFatigue(evaluations: ChapterEmotionEvaluation[]): string[] {
    const alerts: string[] = []
    if (evaluations.length < 3) return alerts

    // 检查连续 3 章高压憋屈
    let consecutiveFrustration = 0
    let consecutiveClimax = 0

    for (const ev of evaluations) {
      if (ev.netPolarity < -25) {
        consecutiveFrustration += 1
      } else {
        consecutiveFrustration = 0
      }

      if (ev.netPolarity > 40) {
        consecutiveClimax += 1
      } else {
        consecutiveClimax = 0
      }

      if (consecutiveFrustration >= 3) {
        alerts.push(`🚨 连载弃书高危：第 ${ev.chapterOrder} 章前已连续 3 章处于高压憋屈期，急需剧情反转打脸！`)
        break
      }

      if (consecutiveClimax >= 3) {
        alerts.push(`⚡ 审美疲劳警报：第 ${ev.chapterOrder} 章前已连续 3 章高频轰炸爽点，缺少中场蓄势铺垫，易让读者麻木。`)
        break
      }
    }

    return alerts
  }
}
