import type {
  VolumeStat,
  TotalBookMetrics,
  VolumeArcRecord,
  ActStage,
  OlsQuadraticResult,
} from '../types'
interface ChapterMeasurement {
  volumeId?: string
  wordCount?: number
  order?: number
  tension?: number
}
const countSum = (chapters: ChapterMeasurement[]): number | null =>
  chapters.every((c) => Number.isSafeInteger(c.wordCount) && c.wordCount! >= 0)
    ? chapters.reduce((sum, c) => sum + c.wordCount!, 0)
    : null
export class VolumeMasterEngine {
  /** Centered/scaled QR fit to supplied measurements; no narrative-quality interpretation. */
  computeOlsQuadratic(points: { x: number; y: number }[]): OlsQuadraticResult | null {
    if (points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y)))
      throw new Error('拟合数据须为有限数值。')
    if (points.length < 3 || new Set(points.map((p) => p.x)).size < 3) return null
    const n = points.length,
      origin = points[0].x
    const center = origin + points.reduce((sum, p) => sum + (p.x - origin) / n, 0)
    const scale = points.reduce((max, p) => Math.max(max, Math.abs(p.x - center)), 0)
    const yScale = points.reduce((max, p) => Math.max(max, Math.abs(p.y)), 0) || 1
    if (!Number.isFinite(center) || !Number.isFinite(scale) || scale === 0)
      throw new Error('数据跨度超出可拟合范围。')
    const z = points.map((p) => (p.x - center) / scale)
    const columns = [points.map(() => 1), z, z.map((x) => x * x)]
    const q: number[][] = [],
      r: number[][] = Array.from({ length: 3 }, () => [0, 0, 0])
    for (let column = 0; column < 3; column++) {
      const v = [...columns[column]]
      for (let prior = 0; prior < column; prior++) {
        const projection = v.reduce((sum, value, index) => sum + value * q[prior][index], 0)
        r[prior][column] = projection
        for (let index = 0; index < n; index++) v[index] -= projection * q[prior][index]
      }
      const norm = Math.sqrt(v.reduce((sum, value) => sum + value * value, 0))
      if (norm <= 1e-12 * Math.sqrt(n)) return null
      r[column][column] = norm
      q.push(v.map((value) => value / norm))
    }
    const normalizedY = points.map((p) => p.y / yScale)
    const rhs = q.map((col) =>
      col.reduce((sum, value, index) => sum + value * normalizedY[index], 0),
    )
    const gamma = [0, 0, 0]
    for (let row = 2; row >= 0; row--) {
      let value = rhs[row]
      for (let next = row + 1; next < 3; next++) value -= r[row][next] * gamma[next]
      gamma[row] = value / r[row][row]
    }
    const mean = normalizedY.reduce((sum, value) => sum + value / n, 0)
    const ssTotal = normalizedY.reduce((sum, value) => sum + (value - mean) ** 2, 0)
    const ssResidual = normalizedY.reduce(
      (sum, value, index) =>
        sum + (value - (gamma[0] + gamma[1] * z[index] + gamma[2] * z[index] ** 2)) ** 2,
      0,
    )
    const beta2 = (gamma[2] / scale / scale) * yScale
    const beta1 = (gamma[1] / scale - (2 * center * gamma[2]) / scale / scale) * yScale
    const beta0 =
      (gamma[0] - (center / scale) * gamma[1] + (center / scale) ** 2 * gamma[2]) * yScale
    if (![beta0, beta1, beta2].every(Number.isFinite)) throw new Error('拟合系数超出数值范围。')
    const peak = gamma[2] < -1e-12 ? center - (scale * gamma[1]) / (2 * gamma[2]) : null
    const min = points.reduce((value, p) => Math.min(value, p.x), Infinity),
      max = points.reduce((value, p) => Math.max(value, p.x), -Infinity)
    return {
      beta0,
      beta1,
      beta2,
      r2: ssTotal === 0 ? null : Math.max(0, Math.min(1, 1 - ssResidual / ssTotal)),
      apexRatio: peak !== null && peak >= min && peak <= max ? peak : null,
      sampleCount: n,
    }
  }
  fitNarrativeArcR2(values: number[]) {
    const fit = this.computeOlsQuadratic(
      values.map((y, index) => ({ x: index / Math.max(1, values.length - 1), y })),
    )
    return {
      r2: fit?.r2 ?? null,
      apexPositionRatio: fit?.apexRatio ?? null,
      sampleCount: values.length,
    }
  }
  calculateVolumeStat(
    volume: { id: string; title: string; order: number },
    chapters: ChapterMeasurement[],
    arc?: VolumeArcRecord,
  ): VolumeStat {
    const selected = chapters.filter((c) => c.volumeId === volume.id)
    const actualWordCount = countSum(selected)
    const targetWordCount = arc?.targetWordCount ?? null
    if (
      targetWordCount !== null &&
      (!Number.isSafeInteger(targetWordCount) || targetWordCount <= 0)
    )
      throw new Error('作者分卷预算须为正整数。')
    const burnRate =
      actualWordCount !== null && targetWordCount !== null
        ? (actualWordCount / targetWordCount) * 100
        : null
    const measured = selected
      .filter((c) => Number.isFinite(c.tension) && Number.isSafeInteger(c.order))
      .sort((a, b) => a.order! - b.order!)
    const allOrdered =
      selected.every((c) => Number.isSafeInteger(c.order)) &&
      new Set(selected.map((c) => c.order)).size === selected.length
    let arcRegression: OlsQuadraticResult | undefined
    if (allOrdered && measured.length >= 3) {
      const min = selected.reduce((value, c) => Math.min(value, c.order!), Infinity),
        max = selected.reduce((value, c) => Math.max(value, c.order!), -Infinity)
      arcRegression =
        this.computeOlsQuadratic(
          measured.map((c) => ({ x: (c.order! - min) / Math.max(1, max - min), y: c.tension! })),
        ) ?? undefined
    }
    const status = arc?.isCompleted
      ? 'author_completed'
      : targetWordCount === null || actualWordCount === null
        ? 'unplanned'
        : actualWordCount > targetWordCount
          ? 'over_budget'
          : 'within_budget'
    return {
      volumeId: volume.id,
      title: volume.title,
      order: volume.order,
      chapterCount: selected.length,
      actualWordCount,
      targetWordCount,
      burnRate,
      status,
      currentAct: arc?.actStage ?? null,
      arcRegression,
      advice:
        status === 'over_budget'
          ? '实际字符数超过作者预算，是否调整由作者决定。'
          : status === 'unplanned'
            ? '预算或实际字符数缺失，剧情阶段不由篇幅推断。'
            : status === 'author_completed'
              ? '作者标记本卷完成；文学质量与读者反馈尚未测量。'
              : '仅比较实际字符数和作者预算；不判断剧情质量。',
    }
  }
  aggregateBookMetrics(
    volumes: Array<{ id: string; title: string; order: number }>,
    chapters: ChapterMeasurement[],
    arcs: VolumeArcRecord[],
  ): TotalBookMetrics {
    const stats = volumes.map((volume) =>
      this.calculateVolumeStat(
        volume,
        chapters,
        arcs.find((a) => a.volumeId === volume.id),
      ),
    )
    const plannedVolumes = stats.filter((s) => s.targetWordCount !== null).length
    return {
      totalVolumes: volumes.length,
      totalChapters: chapters.length,
      totalWordCount: countSum(chapters),
      plannedVolumes,
      projectedTotalWords:
        plannedVolumes === volumes.length && volumes.length
          ? stats.reduce((sum, s) => sum + s.targetWordCount!, 0)
          : null,
    }
  }
  getActStageInfo(stage: ActStage) {
    const info = {
      act1_intro: { label: '目标与初始状态', desc: '作者选定的规划阶段。' },
      act2_rising: { label: '推进与变化', desc: '作者选定的规划阶段。' },
      act3_climax: { label: '关键选择与后果', desc: '作者选定的规划阶段。' },
      act4_fallout: { label: '收束与承接', desc: '作者选定的规划阶段。' },
    }[stage]
    return { ...info, progressRange: '作者规划，无固定篇幅比例' }
  }
}
export const volumeMasterEngine = new VolumeMasterEngine()
