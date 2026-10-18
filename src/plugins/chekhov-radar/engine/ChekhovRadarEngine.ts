import type { ChekhovRadarStats, PlantGunSuggestion, ChekhovGunRecord } from '../types'

export class ChekhovRadarEngine {
  static isReminderDue(gun: ChekhovGunRecord, currentChapter: number): boolean {
    if (gun.status === 'fired' || gun.status === 'abandoned') return false
    if (
      !Number.isSafeInteger(currentChapter) ||
      currentChapter < 1 ||
      !Number.isSafeInteger(gun.plantChapterOrder) ||
      gun.plantChapterOrder < 1 ||
      currentChapter < gun.plantChapterOrder
    )
      return false
    const deadline = gun.expectedPayoffChapterOrder
    if (
      deadline !== undefined &&
      Number.isSafeInteger(deadline) &&
      deadline >= gun.plantChapterOrder
    )
      return currentChapter > deadline
    const interval = gun.reviewAfterChapters
    return (
      interval !== undefined &&
      Number.isSafeInteger(interval) &&
      interval > 0 &&
      currentChapter - gun.plantChapterOrder >= interval
    )
  }

  static computeStats(guns: ChekhovGunRecord[], currentChapter: number): ChekhovRadarStats {
    const retained = guns.filter((gun) => gun.status !== 'abandoned')
    const firedCount = retained.filter((gun) => gun.status === 'fired').length
    return {
      totalGuns: guns.length,
      firedCount,
      dormantCount: guns.filter((gun) => gun.status === 'dormant').length,
      incubatingCount: guns.filter((gun) => gun.status === 'incubating').length,
      rustingCount: guns.filter((gun) => this.isReminderDue(gun, currentChapter)).length,
      abandonedCount: guns.length - retained.length,
      unpositionedCount: retained.filter(
        (gun) => !Number.isSafeInteger(gun.plantChapterOrder) || gun.plantChapterOrder < 1,
      ).length,
      closureRate: retained.length ? Math.round((firedCount / retained.length) * 100) : null,
    }
  }

  static detectPotentialGuns(
    text: string,
    terms: Array<{ name: string; category: PlantGunSuggestion['category'] }> = [],
  ): PlantGunSuggestion[] {
    const literalTerms: typeof terms = [
      ...terms,
      ...[
        '残卷',
        '玉佩',
        '铜镜',
        '古剑',
        '断刃',
        '指环',
        '手镯',
        '黑鼎',
        '锦囊',
        '小鼎',
        '骨片',
        '道符',
        '令牌',
      ].map((name) => ({ name, category: 'item' as const })),
      ...['身世', '遗言', '灭门之谜', '神秘印记', '临终嘱托', '失踪之谜'].map((name) => ({
        name,
        category: 'secret' as const,
      })),
      ...['誓言', '三年之后', '定当登门', '有朝一日', '决战之日', '不共戴天'].map((name) => ({
        name,
        category: 'promise' as const,
      })),
    ]
    const seen = new Set<string>(),
      suggestions: PlantGunSuggestion[] = []
    for (const term of literalTerms) {
      const name = term.name.trim()
      if (!name) continue
      let from = 0
      while (from < text.length) {
        const startOffset = text.indexOf(name, from)
        if (startOffset < 0) break
        const endOffset = startOffset + name.length
        const key = startOffset + ':' + name
        if (!seen.has(key)) {
          seen.add(key)
          suggestions.push({
            gunName: name,
            category: term.category,
            snippet: text.slice(startOffset, endOffset),
            startOffset,
            endOffset,
            reason: '原文提及定位词。是否承诺后续发展、是否属于伏笔，由作者结合语境确认。',
          })
        }
        from = endOffset
      }
    }
    return suggestions.sort((a, b) => a.startOffset - b.startOffset)
  }

  static checkMentionedGuns(
    guns: ChekhovGunRecord[],
    text: string,
    _projectId?: string,
  ): ChekhovGunRecord[] {
    return guns.filter(
      (gun) =>
        gun.status !== 'fired' &&
        gun.status !== 'abandoned' &&
        gun.gunName.trim().length > 0 &&
        text.includes(gun.gunName),
    )
  }
}
