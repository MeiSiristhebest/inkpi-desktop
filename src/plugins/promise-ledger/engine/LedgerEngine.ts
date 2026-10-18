import type { PromiseLedgerEntry, DebtSnapshot, PayoffCandidate } from '../types'

const positiveChapter = (value: number) => Number.isSafeInteger(value) && value > 0

export class LedgerEngine {
  public computeDebtSnapshot(
    entries: PromiseLedgerEntry[],
    currentChapter: number,
  ): DebtSnapshot[] {
    return entries.map((entry) => {
      const positioned = positiveChapter(entry.plantChapter) && positiveChapter(currentChapter)
      const elapsedChapters = positioned ? Math.max(0, currentChapter - entry.plantChapter) : null
      const open = entry.status === 'planted' || entry.status === 'progressing'
      const deadlineChapter =
        positioned && positiveChapter(entry.dueChapterLimit)
          ? entry.plantChapter + entry.dueChapterLimit
          : null
      const beforePlant = positioned && currentChapter < entry.plantChapter
      const remainingChapters = deadlineChapter === null ? null : deadlineChapter - currentChapter
      const isOverdue = open && !beforePlant && remainingChapters !== null && remainingChapters < 0
      const isDue = open && !beforePlant && remainingChapters === 0
      const isWarning =
        open &&
        !beforePlant &&
        !isOverdue &&
        !isDue &&
        elapsedChapters !== null &&
        positiveChapter(entry.softDeadline) &&
        elapsedChapters >= entry.softDeadline
      const progressChapters = (entry.progressHistory ?? [])
        .map((p) => p.chapter)
        .filter(
          (chapter) =>
            positioned &&
            positiveChapter(chapter) &&
            chapter >= entry.plantChapter &&
            chapter <= currentChapter,
        )
      const lastProgressChapter =
        positioned && !beforePlant ? Math.max(entry.plantChapter, ...progressChapters) : null
      return {
        entry,
        elapsedChapters,
        deadlineChapter,
        remainingChapters,
        lastProgressChapter,
        isOverdue,
        isDue,
        isWarning,
      }
    })
  }

  public detectPayoffCandidates(text: string, entries: PromiseLedgerEntry[]): PayoffCandidate[] {
    if (!text.trim()) return []
    const candidates: PayoffCandidate[] = []
    for (const entry of entries) {
      if (entry.status !== 'planted' && entry.status !== 'progressing') continue
      const clue = entry.clueName.trim()
      if (!clue) continue
      const words = text.includes(clue)
        ? [clue]
        : [...new Set(clue.split(/[\s,，、。:：;；—\-()（）]+/).filter((word) => word.length >= 2))]
      for (const word of words) {
        let from = 0
        while (from < text.length) {
          const startOffset = text.indexOf(word, from)
          if (startOffset < 0) break
          const endOffset = startOffset + word.length
          candidates.push({
            entryId: entry.id,
            clueName: clue,
            matchedKeyword: word,
            snippet: text.slice(startOffset, endOffset),
            startOffset,
            endOffset,
            status: 'mention',
          })
          from = endOffset
        }
      }
    }
    return candidates
  }
}
export const ledgerEngine = new LedgerEngine()
