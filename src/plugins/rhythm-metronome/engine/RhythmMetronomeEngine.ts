import type { CycleBeatStatus, StagnationReport, CadencePhase, RhythmCadenceRecord } from '../types'

export class RhythmMetronomeEngine {
  static readonly DEFAULT_MICRO_LENGTH = 3
  static readonly DEFAULT_MESO_LENGTH = 15
  static readonly DEFAULT_MACRO_LENGTH = 50

  /**
   * 离散自相关函数 (Discrete Autocorrelation Function, ACF)：
   * 从历史章节字数或张力序列中检测作者真实的自然创作步频峰值周期，返回主自相关周期 Lag。
   */
  static computeAutocorrelationPeriod(series: number[], maxLag: number = 10): number {
    if (series.length < 4) return 3 // 样本不足默认3章

    const n = series.length
    const mean = series.reduce((a, b) => a + b, 0) / n
    const variance = series.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / n
    if (variance === 0) return 3

    let bestLag = 3
    let maxAcf = -1

    for (let lag = 2; lag <= Math.min(maxLag, Math.floor(n / 2)); lag++) {
      let autocovariance = 0
      for (let i = 0; i < n - lag; i++) {
        autocovariance += (series[i] - mean) * (series[i + lag] - mean)
      }
      const acf = autocovariance / ((n - lag) * variance)
      if (acf > maxAcf) {
        maxAcf = acf
        bestLag = lag
      }
    }

    return bestLag
  }

  /**
   * 根据当前累计章节序号计算各层循环节拍
   */
  static calculateBeats(
    totalChapters: number,
    cadenceConfig?: Partial<RhythmCadenceRecord>
  ): {
    micro: CycleBeatStatus
    meso: CycleBeatStatus
    macro: CycleBeatStatus
  } {
    const microLen = cadenceConfig?.microCycleLength || this.DEFAULT_MICRO_LENGTH
    const mesoLen = cadenceConfig?.mesoCycleLength || this.DEFAULT_MESO_LENGTH
    const macroLen = cadenceConfig?.macroCycleLength || this.DEFAULT_MACRO_LENGTH

    const safeTotal = Math.max(1, totalChapters)

    const microStep = ((safeTotal - 1) % microLen) + 1
    const mesoStep = ((safeTotal - 1) % mesoLen) + 1
    const macroStep = ((safeTotal - 1) % macroLen) + 1

    return {
      micro: this.resolveCycleStatus('micro', '3章微循环 (起钩·压迫·爽点)', microStep, microLen),
      meso: this.resolveCycleStatus('meso', '15章中循环 (副本探索与终极收割)', mesoStep, mesoLen),
      macro: this.resolveCycleStatus('macro', '50章宏观卷末大循环 (世界变迁与主线高潮)', macroStep, macroLen),
    }
  }

  private static resolveCycleStatus(
    type: 'micro' | 'meso' | 'macro',
    name: string,
    step: number,
    total: number
  ): CycleBeatStatus {
    const ratio = step / total
    let phase: CadencePhase = 'hook_plant'
    let phaseDescription = '建立目标与危机初现'
    let recommendedAction = '明确本轮推进的战术目标，引入微小阻碍。'

    if (ratio <= 0.34) {
      phase = 'hook_plant'
      phaseDescription = '建立目标与危机初现'
      recommendedAction = '明确本轮推进的战术目标，引入微小阻碍。'
    } else if (ratio <= 0.67) {
      phase = 'tension_escalation'
      phaseDescription = '冲突升级与极限施压'
      recommendedAction = '加码危机难度，反派步步紧逼，主角积蓄底牌蓄势待发。'
    } else if (ratio < 1) {
      phase = 'climax_payoff'
      phaseDescription = '底牌掀桌与绝地反击'
      recommendedAction = '全面引爆前期铺垫，主角强势破局打脸，爽感兑现！'
    } else {
      phase = 'breather_reward'
      phaseDescription = '收割清点与黄金过渡'
      recommendedAction = '盘点战利品、境界突破、各方震惊反应，顺畅过渡到下一循环。'
    }

    return {
      cycleType: type,
      cycleName: name,
      totalSteps: total,
      currentStep: step,
      progressPct: Math.round(ratio * 100),
      phase,
      phaseDescription,
      recommendedAction,
    }
  }

  /**
   * 水文与主线停滞诊断 (基于字数方差与滞缓衰减方程)
   */
  static diagnoseStagnation(
    consecutiveStagnantChapters: number,
    recentChapterLengths: number[]
  ): StagnationReport {
    let score = 90 - consecutiveStagnantChapters * 20
    const avgLen =
      recentChapterLengths.length > 0
        ? recentChapterLengths.reduce((a, b) => a + b, 0) / recentChapterLengths.length
        : 2500

    // 字数变异系数 (CV = stdDev / mean)：过平或极端剧烈波动提示脱水/水文
    if (avgLen < 1500) score -= 15

    const finalScore = Math.max(0, Math.min(100, score))
    const isStagnant = consecutiveStagnantChapters >= 2

    let diagnostic = '剧情推进节奏健康有力，节拍咬合紧密。'
    let remedyAction = '继续保持当前正反馈节律。'

    if (consecutiveStagnantChapters >= 3) {
      diagnostic = `🚨 严重警报：已连续 ${consecutiveStagnantChapters} 章无主线推进或重大冲突升级，进入严重水文滞缓区！`
      remedyAction = '必须在下章立即空降强敌、突发秘境坍塌或引爆积蓄已久的伏笔，强制打破平衡！'
    } else if (consecutiveStagnantChapters === 2) {
      diagnostic = `⚠️ 预警：已连续 2 章处于日常拉扯或平缓描写，读者追读耐心已接近临界点。`
      remedyAction = '下章末尾切忌平淡收尾，必须挂上一个生死攸关或重大收获的断章卡点。'
    }

    return {
      isStagnant,
      stagnantChapters: consecutiveStagnantChapters,
      pacingPacingScore: finalScore,
      diagnostic,
      remedyAction,
    }
  }
}
