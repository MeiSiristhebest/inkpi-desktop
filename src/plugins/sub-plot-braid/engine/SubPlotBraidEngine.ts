import type { SubPlotStrand, ThreadHealthMetric } from '../types'

export class SubPlotBraidEngine {
  /**
   * 评估全书所有副线的休眠健康度与掉线饥饿度
   */
  static assessStrandHealth(params: {
    strands: SubPlotStrand[]
    currentMaxChapterOrder: number
  }): ThreadHealthMetric[] {
    const { strands, currentMaxChapterOrder } = params

    return strands.map((s) => {
      // 只有活跃或高潮中的支线才计算休眠饥饿度
      const isOngoing = s.status === 'active' || s.status === 'climax'
      const lastActive = s.lastActiveChapterOrder || s.startChapterOrder || 1
      const dormancyDistance = isOngoing ? Math.max(0, currentMaxChapterOrder - lastActive) : 0

      const isStarved = isOngoing && dormancyDistance >= 15
      const isCriticalAbandoned = isOngoing && dormancyDistance >= 30

      let convergenceReadiness: ThreadHealthMetric['convergenceReadiness'] = 'progressing'
      if (s.status === 'resolved') {
        convergenceReadiness = 'ready'
      } else if (isStarved) {
        convergenceReadiness = 'cold'
      }

      return {
        strandId: s.id,
        title: s.title,
        dormancyDistance,
        isStarved,
        isCriticalAbandoned,
        convergenceReadiness,
      }
    })
  }

  /**
   * 自动在正文片段中探测与哪些支线角色或线索关键词强相关
   */
  static detectActiveStrandsInText(params: {
    text: string
    strands: SubPlotStrand[]
  }): SubPlotStrand[] {
    const { text, strands } = params
    if (!text) return []

    return strands.filter((s) => {
      // 检查标题、标签或参演角色
      if (text.includes(s.title)) return true
      for (const charName of s.involvedCharacterNames) {
        if (charName && text.includes(charName)) return true
      }
      for (const tag of s.tags) {
        if (tag && text.includes(tag)) return true
      }
      return false
    })
  }
}
