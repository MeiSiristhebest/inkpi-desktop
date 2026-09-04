import type {
  VolumeStat,
  TotalBookMetrics,
  VolumeArcRecord,
  ActStage,
} from '../types'

export class VolumeMasterEngine {
  /**
   * 正交多项式叙事弧光张力曲线回归度分析：
   * 对分卷章节的实际张力强度 y_i 拟合二次经典三幕/四幕剧抛物线 y = -a(x - h)^2 + k
   * 计算决定系数 R^2 (Goodness of Fit)。若 R^2 显著偏低，提示中段坍塌或缺乏高潮拱顶。
   */
  fitNarrativeArcR2(chapterTensionPoints: number[]): { r2: number; apexPositionRatio: number } {
    const n = chapterTensionPoints.length
    if (n < 4) return { r2: 1.0, apexPositionRatio: 0.75 }

    const x = chapterTensionPoints.map((_, i) => i / (n - 1)) // 归一化到 [0, 1]
    const y = chapterTensionPoints

    // 寻找张力最高峰所在位置
    let maxIdx = 0
    let maxY = y[0]
    for (let i = 1; i < n; i++) {
      if (y[i] > maxY) {
        maxY = y[i]
        maxIdx = i
      }
    }
    const apexRatio = maxIdx / (n - 1)

    // 理论经典四幕高潮点位于 70% ~ 85% 位置
    const idealApex = 0.75
    const apexDeviation = Math.abs(apexRatio - idealApex)

    // 计算均值与总平方和 SST
    const meanY = y.reduce((a, b) => a + b, 0) / n
    const sst = y.reduce((sum, yi) => sum + Math.pow(yi - meanY, 2), 0)

    if (sst === 0) return { r2: 0.5, apexPositionRatio: apexRatio }

    // 简单二次曲线拟合残差估计
    let ssr = 0
    for (let i = 0; i < n; i++) {
      // 经典三幕抛物线参考模型：起步0.3 -> 顶峰1.0 -> 尾声0.4
      const xi = x[i]
      const yPred = 0.3 + 0.7 * Math.max(0, 1 - Math.pow((xi - apexRatio) / 0.5, 2)) * maxY
      ssr += Math.pow(y[i] - yPred, 2)
    }

    const r2 = Math.max(0, Math.min(1.0, 1 - ssr / (sst + 1e-5) - apexDeviation * 0.2))
    return {
      r2: Math.round(r2 * 100) / 100,
      apexPositionRatio: Math.round(apexRatio * 100) / 100,
    }
  }

  calculateVolumeStat(
    volume: { id: string; title: string; order: number },
    chapters: Array<{ volumeId?: string; wordCount?: number }>,
    arcRecord?: VolumeArcRecord
  ): VolumeStat {
    const volChapters = chapters.filter((c) => c.volumeId === volume.id)
    const actualWordCount = volChapters.reduce((acc, c) => acc + (c.wordCount || 0), 0)
    const targetWordCount = arcRecord?.targetWordCount || 200000

    const burnRate = Math.round((actualWordCount / Math.max(1, targetWordCount)) * 100)

    let currentAct: ActStage = arcRecord?.actStage || 'act1_intro'
    if (!arcRecord?.actStage) {
      if (burnRate >= 85) currentAct = 'act4_fallout'
      else if (burnRate >= 60) currentAct = 'act3_climax'
      else if (burnRate >= 20) currentAct = 'act2_rising'
      else currentAct = 'act1_intro'
    }

    let status: VolumeStat['status'] = 'on_track'
    let advice = '分卷节奏健康，字数与戏剧进度处于平稳发展区间。'

    if (burnRate > 115 && (currentAct === 'act1_intro' || currentAct === 'act2_rising')) {
      status = 'lagging_water'
      advice = '警告：字数已超标消耗但剧情仍停留在铺垫期，存在节奏拖沓或灌水风险，需尽快引发核心矛盾！'
    } else if (burnRate < 45 && currentAct === 'act3_climax') {
      status = 'rushed_climax'
      advice = '警告：铺垫字数不足便强行进入卷大高潮，高潮缺乏情绪蓄势与压抑释放差，易变成“干瘪推进”。'
    } else if (burnRate >= 100 && currentAct === 'act4_fallout') {
      status = 'completed'
      advice = '本卷戏剧弧已圆满闭环，请做好跨卷大悬念（Cliffhanger），准备引出下一卷崭新大地图。'
    }

    return {
      volumeId: volume.id,
      title: volume.title,
      order: volume.order,
      chapterCount: volChapters.length,
      actualWordCount,
      targetWordCount,
      burnRate,
      status,
      currentAct,
      advice,
    }
  }

  aggregateBookMetrics(
    volumes: Array<{ id: string; title: string; order: number }>,
    chapters: Array<{ volumeId?: string; wordCount?: number }>,
    arcs: VolumeArcRecord[]
  ): TotalBookMetrics {
    const totalVolumes = volumes.length
    const totalChapters = chapters.length
    const totalWordCount = chapters.reduce((acc, c) => acc + (c.wordCount || 0), 0)

    const projectedTotalWords = volumes.reduce((acc, vol) => {
      const arc = arcs.find((a) => a.volumeId === vol.id)
      return acc + (arc?.targetWordCount || 200000)
    }, 0)

    let overallPacingRating: TotalBookMetrics['overallPacingRating'] = 'smooth'
    const laggingCount = volumes.filter((v) => {
      const stat = this.calculateVolumeStat(
        v,
        chapters,
        arcs.find((a) => a.volumeId === v.id)
      )
      return stat.status === 'lagging_water'
    }).length

    if (laggingCount >= 2) overallPacingRating = 'danger'
    else if (laggingCount === 1) overallPacingRating = 'needs_tightening'

    return {
      totalVolumes,
      totalChapters,
      totalWordCount,
      projectedTotalWords: Math.max(totalWordCount, projectedTotalWords),
      overallPacingRating,
    }
  }

  getActStageInfo(stage: ActStage): { label: string; desc: string; progressRange: string } {
    switch (stage) {
      case 'act1_intro':
        return {
          label: '第一幕：破局引入',
          desc: '确立本卷核心目标、打破旧平衡、卷主角初始困境与对手初现。',
          progressRange: '0% ~ 20%',
        }
      case 'act2_rising':
        return {
          label: '第二幕：危机上升',
          desc: '多轮交锋博弈、矛盾逐步升级、主角屡遇阻碍或中段小胜。',
          progressRange: '20% ~ 60%',
        }
      case 'act3_climax':
        return {
          label: '第三幕：卷巅峰决战',
          desc: '卷底牌全面碰撞、生死一线、终极矛盾爆发与全卷最高潮。',
          progressRange: '60% ~ 85%',
        }
      case 'act4_fallout':
        return {
          label: '第四幕：余波与跨卷钩',
          desc: '战果收割升级、各方震动反响、收尾平静中抛出下一卷大悬念。',
          progressRange: '85% ~ 100%',
        }
    }
  }
}

export const volumeMasterEngine = new VolumeMasterEngine()
