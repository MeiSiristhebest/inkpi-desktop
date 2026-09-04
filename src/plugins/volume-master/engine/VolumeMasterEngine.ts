import type {
  VolumeStat,
  TotalBookMetrics,
  VolumeArcRecord,
  ActStage,
} from '../types'

export class VolumeMasterEngine {
  /**
   * 普通最小二乘法 (OLS) 二阶多项式回归求解器：
   * 拟合 y = beta2 * x^2 + beta1 * x + beta0
   * 求解正规方程组 (X^T * X) * Beta = X^T * Y (Cramer法则精确求解)
   * 并计算判定系数 R^2 = 1 - SS_res / SS_tot 与二次顶点归一化位置 apexRatio = -beta1 / (2 * beta2)
   */
  computeOlsQuadratic(points: { x: number; y: number }[]): {
    beta0: number
    beta1: number
    beta2: number
    r2: number
    apexRatio: number
  } {
    const n = points.length
    if (n < 3) {
      return { beta0: 0, beta1: 0, beta2: 0, r2: 0, apexRatio: 0 }
    }

    let s0 = n
    let s1 = 0, s2 = 0, s3 = 0, s4 = 0
    let t0 = 0, t1 = 0, t2 = 0

    for (const p of points) {
      const x = p.x
      const y = p.y
      const x2 = x * x
      s1 += x
      s2 += x2
      s3 += x2 * x
      s4 += x2 * x2

      t0 += y
      t1 += x * y
      t2 += x2 * y
    }

    // 3x3 行列式 Det(X^T * X)
    const det =
      s0 * (s2 * s4 - s3 * s3) -
      s1 * (s1 * s4 - s2 * s3) +
      s2 * (s1 * s3 - s2 * s2)

    if (Math.abs(det) < 1e-12) {
      return { beta0: 0, beta1: 0, beta2: 0, r2: 0, apexRatio: 0 }
    }

    const det0 =
      t0 * (s2 * s4 - s3 * s3) -
      s1 * (t1 * s4 - t2 * s3) +
      s2 * (t1 * s3 - t2 * s2)

    const det1 =
      s0 * (t1 * s4 - t2 * s3) -
      t0 * (s1 * s4 - s2 * s3) +
      s2 * (s1 * t2 - s2 * t1)

    const det2 =
      s0 * (s2 * t2 - s3 * t1) -
      s1 * (s1 * t2 - s2 * t1) +
      t0 * (s1 * s3 - s2 * s2)

    const beta0 = det0 / det
    const beta1 = det1 / det
    const beta2 = det2 / det

    // 计算总平方和 SS_tot 与残差平方和 SS_res
    const meanY = t0 / n
    let ssTot = 0
    let ssRes = 0

    for (const p of points) {
      const yPred = beta0 + beta1 * p.x + beta2 * p.x * p.x
      ssRes += (p.y - yPred) * (p.y - yPred)
      ssTot += (p.y - meanY) * (p.y - meanY)
    }

    const r2 = ssTot === 0 ? 1.0 : Math.max(0, 1 - ssRes / ssTot)
    const apexRatio = beta2 !== 0 ? -beta1 / (2 * beta2) : 0

    return {
      beta0,
      beta1,
      beta2,
      r2,
      apexRatio,
    }
  }

  /**
   * 正交/普通多项式叙事弧光张力曲线回归度分析：
   * 对分卷章节的实际张力序列拟合 OLS 二阶曲线 y = beta2 * x^2 + beta1 * x + beta0
   * 输出决定系数 R^2 与高潮顶点归一化位置 apexPositionRatio
   */
  fitNarrativeArcR2(chapterTensionPoints: number[]): { r2: number; apexPositionRatio: number } {
    const n = chapterTensionPoints.length
    if (n < 3) return { r2: 1.0, apexPositionRatio: 0.75 }

    const points = chapterTensionPoints.map((y, i) => ({
      x: i / (n - 1),
      y,
    }))

    const ols = this.computeOlsQuadratic(points)

    // 顶点位置归一化夹紧于 [0, 1]
    const clampedApex = Math.max(0, Math.min(1.0, ols.apexRatio))

    return {
      r2: Math.round(ols.r2 * 1000) / 1000,
      apexPositionRatio: Math.round(clampedApex * 1000) / 1000,
    }
  }

  calculateVolumeStat(
    volume: { id: string; title: string; order: number },
    chapters: Array<{ volumeId?: string; wordCount?: number; tension?: number }>,
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

    // 计算分卷章节张力回归弧线（若有张力点）
    let arcRegression: VolumeStat['arcRegression'] = undefined
    const tensionPoints: number[] = volChapters
      .map((c, idx) => {
        if (typeof c.tension === 'number') return c.tension
        // 若未显式录入章节张力，根据章节位次按理论三幕阶段赋予张力基线 (0.2 ~ 0.9)
        const progress = volChapters.length > 1 ? idx / (volChapters.length - 1) : 0.5
        return Math.sin(progress * Math.PI) * 0.7 + 0.2
      })

    if (tensionPoints.length >= 3) {
      const regressionPoints = tensionPoints.map((y, i) => ({
        x: i / (tensionPoints.length - 1),
        y,
      }))
      const ols = this.computeOlsQuadratic(regressionPoints)
      arcRegression = {
        beta0: Math.round(ols.beta0 * 1000) / 1000,
        beta1: Math.round(ols.beta1 * 1000) / 1000,
        beta2: Math.round(ols.beta2 * 1000) / 1000,
        r2: Math.round(ols.r2 * 1000) / 1000,
        apexRatio: Math.round(Math.max(0, Math.min(1.0, ols.apexRatio)) * 1000) / 1000,
      }
    }

    if (burnRate > 115 && (currentAct === 'act1_intro' || currentAct === 'act2_rising')) {
      status = 'lagging_water'
      advice = '警告：字数已超标消耗但剧情仍停留在铺垫期，存在节奏拖沓或灌水风险，需尽快引发核心矛盾！'
    } else if (burnRate < 45 && currentAct === 'act3_climax') {
      status = 'rushed_climax'
      advice = '警告：铺垫字数不足便强行进入卷大高潮，高潮缺乏情绪蓄势与压抑释放差，易变成“干瘪推进”。'
    } else if (burnRate >= 100 && currentAct === 'act4_fallout') {
      status = 'completed'
      advice = '本卷戏剧弧已圆满闭环，请做好跨卷大悬念（Cliffhanger），准备引出下一卷崭新大地图。'
    } else if (arcRegression && arcRegression.r2 < 0.25 && volChapters.length >= 5) {
      advice = '提示：当前分卷戏剧张力波动与标准戏剧弧相关度较低（R²偏低），建议检查中段是否缺乏危机蓄势或高潮拱顶。'
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
      arcRegression,
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
