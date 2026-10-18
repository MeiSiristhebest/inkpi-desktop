import type { SubPlotStrand, ThreadHealthMetric } from '../types'
const chapterNumber = (value: number) => Number.isSafeInteger(value) && value > 0

export class SubPlotBraidEngine {
  static assessStrandHealth(params: {
    strands: SubPlotStrand[]
    currentMaxChapterOrder: number
  }): ThreadHealthMetric[] {
    const { strands, currentMaxChapterOrder } = params
    return strands.map((strand) => {
      const last = chapterNumber(strand.lastActiveChapterOrder)
        ? strand.lastActiveChapterOrder
        : chapterNumber(strand.startChapterOrder)
          ? strand.startChapterOrder
          : null
      const dormancyDistance =
        last !== null && chapterNumber(currentMaxChapterOrder) && last <= currentMaxChapterOrder
          ? currentMaxChapterOrder - last
          : null
      const ongoing = strand.status === 'active' || strand.status === 'climax'
      const interval = strand.reminderAfterChapters
      const isStarved =
        ongoing &&
        dormancyDistance !== null &&
        interval !== undefined &&
        chapterNumber(interval) &&
        dormancyDistance >= interval
      const prerequisites = strand.prerequisiteStrandIds
      const pendingPrerequisites =
        prerequisites?.filter(
          (id) =>
            id === strand.id ||
            !strands.some(
              (other) =>
                other.id === id &&
                other.projectId === strand.projectId &&
                other.status === 'resolved',
            ),
        ) ?? []
      const convergenceReadiness: ThreadHealthMetric['convergenceReadiness'] =
        prerequisites === undefined || !strand.convergenceNote?.trim()
          ? 'unknown'
          : pendingPrerequisites.length
            ? 'blocked'
            : 'ready'
      return {
        strandId: strand.id,
        title: strand.title,
        dormancyDistance,
        isStarved,
        convergenceReadiness,
        pendingPrerequisites,
      }
    })
  }

  static locateMentions(params: {
    text: string
    strands: SubPlotStrand[]
  }): Array<{ strandId: string; quote: string; startOffset: number; endOffset: number }> {
    const mentions: Array<{
      strandId: string
      quote: string
      startOffset: number
      endOffset: number
    }> = []
    for (const strand of params.strands) {
      const words = new Set(
        [strand.title, ...strand.involvedCharacterNames, ...strand.tags]
          .map((word) => word.trim())
          .filter(Boolean),
      )
      for (const word of words) {
        let from = 0
        while (from < params.text.length) {
          const startOffset = params.text.indexOf(word, from)
          if (startOffset < 0) break
          const endOffset = startOffset + word.length
          mentions.push({
            strandId: strand.id,
            quote: params.text.slice(startOffset, endOffset),
            startOffset,
            endOffset,
          })
          from = endOffset
        }
      }
    }
    return mentions.sort((a, b) => a.startOffset - b.startOffset)
  }

  static detectActiveStrandsInText(params: {
    text: string
    strands: SubPlotStrand[]
  }): SubPlotStrand[] {
    const ids = new Set(this.locateMentions(params).map((mention) => mention.strandId))
    return params.strands.filter((strand) => ids.has(strand.id))
  }
}
