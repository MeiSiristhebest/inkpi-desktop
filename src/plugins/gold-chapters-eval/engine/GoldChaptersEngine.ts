import type { GoldChaptersEvaluation } from "../types"

/**
 * GoldChaptersEngine (黄金三章签约过稿诊断器引擎)
 *
 * 理论基础：网文商业过稿多维加权评价向量 SignabilityScore = W * S
 * 权重配置：
 * - 主角核心动机紧迫度 (0.25)
 * - 核心金手指/筹码登场时机与辨识度 (0.30)
 * - 主要矛盾与危机压迫感 (0.25)
 * - 3000 字阅读吸入与期待感 (0.20)
 */
export class GoldChaptersEngine {
  public static evaluate(chaptersText: string): GoldChaptersEvaluation {
    const first3k = chaptersText.slice(0, 3000)

    const keyDiagnosis: string[] = []
    const suggestions: string[] = []

    // 1. 主角核心动机明确度 (0 ~ 100)
    let motiveScore = 60
    if (/(复仇|报仇|生存|活下去|救母|登顶|变强|退婚|洗清冤屈)/.test(first3k)) {
      motiveScore = 95
      keyDiagnosis.push("主角在前 3000 字展现出清晰强烈的主观动机")
    } else {
      motiveScore = 50
      keyDiagnosis.push("开篇缺乏高压动机驱动，主角行动过于被动随波逐流")
      suggestions.push("在第 1000 字内注入外部生死/名誉/利益危机，明确主角第一阶段目标")
    }

    // 2. 金手指/核心筹码评估 (0 ~ 100)
    let goldFingerScore = 55
    if (/(系统|金手指|面板|铜戒|穿越|觉醒|签到|残卷|古玉|神级)/.test(first3k)) {
      goldFingerScore = 90
      keyDiagnosis.push("核心筹码/金手指在前 3000 字即时登场，卖点鲜明")
    } else {
      goldFingerScore = 40
      keyDiagnosis.push("前 3000 字未见核心金手指或差异化金刚钻，容易被编辑判定为慢热劝退")
      suggestions.push("将主角核心特殊能力或机缘提前至第一章中段，形成读者第一爽点期待")
    }

    // 3. 主要矛盾与危机压迫感 (0 ~ 100)
    let conflictScore = 65
    if (/(欺凌|剥夺|杀意|逼迫|嘲弄|冷嘲热讽|生死战|危在旦夕)/.test(first3k)) {
      conflictScore = 90
      keyDiagnosis.push("开门见山确立主要矛盾冲突，戏剧张力饱满")
    } else {
      conflictScore = 55
      keyDiagnosis.push("主要矛盾确立拖沓，过多背景世界观铺垫削弱了冲突压迫")
      suggestions.push("删减前 1500 字中的世界观纯说明段落，以动作戏或直接对手戏开局")
    }

    // 4. 期待感与章末断章切口 (0 ~ 100)
    let expectationScore = 70
    if (/(原来|冷笑|这一次|誓要|天翻地覆|且看|竟是)/.test(chaptersText.slice(-500))) {
      expectationScore = 88
      keyDiagnosis.push("章末断章留钩有力，具备吸引读者点击下一章的强驱动")
    } else {
      expectationScore = 55
      suggestions.push("在第三章末尾设置关键悬念或重大事件爆发前兆")
    }

    // 综合加权评分
    const score = Math.round(
      0.25 * motiveScore +
      0.30 * goldFingerScore +
      0.25 * conflictScore +
      0.20 * expectationScore
    )

    const isQualified = score >= 75

    return {
      score,
      isQualified,
      motiveScore,
      goldFingerScore,
      conflictScore,
      expectationScore,
      keyDiagnosis,
      suggestions,
    }
  }
}
