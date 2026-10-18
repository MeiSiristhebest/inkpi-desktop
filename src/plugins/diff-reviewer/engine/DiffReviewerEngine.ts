import * as Diff from 'diff'
import type {
  DiffComputeResult,
  ReviewHunkView,
  DiffLineChange,
  DiffWordToken,
  HunkResolution,
} from '../types'

function rawLines(text: string): string[] {
  return text.match(/[^\n]*\n|[^\n]+$/g) ?? []
}
function lineOffset(lines: string[], index: number): number {
  return lines.slice(0, index).reduce((sum, line) => sum + line.length, 0)
}

export class DiffReviewerEngine {
  static computeDiff(oldText: string, newText: string): DiffComputeResult {
    const patch = Diff.structuredPatch('original.txt', 'proposed.txt', oldText, newText, '', '', {
      context: 2,
    })
    const oldLines = rawLines(oldText)
    const newLines = rawLines(newText)
    const parts = Diff.diffLines(oldText, newText)
    const stats = { additions: 0, deletions: 0, unmodified: 0 }
    for (const part of parts) {
      const count = rawLines(part.value).length
      if (part.added) stats.additions += count
      else if (part.removed) stats.deletions += count
      else stats.unmodified += count
    }
    const hunks: ReviewHunkView[] = patch.hunks.map((raw, index) => {
      let oldCur = raw.oldStart
      let newCur = raw.newStart
      const lineChanges: DiffLineChange[] = []
      for (const line of raw.lines) {
        const marker = line[0]
        if (marker === '\\') continue
        if (marker === '+')
          lineChanges.push({ type: 'added', newLineNumber: newCur++, content: line.slice(1) })
        else if (marker === '-')
          lineChanges.push({ type: 'removed', oldLineNumber: oldCur++, content: line.slice(1) })
        else if (marker === ' ')
          lineChanges.push({
            type: 'unchanged',
            oldLineNumber: oldCur++,
            newLineNumber: newCur++,
            content: line.slice(1),
          })
      }
      this.enrichWordTokens(lineChanges)
      const oldIndex = raw.oldLines === 0 ? raw.oldStart : Math.max(0, raw.oldStart - 1)
      const newIndex = raw.newLines === 0 ? raw.newStart : Math.max(0, raw.newStart - 1)
      const sourceStart = lineOffset(oldLines, oldIndex)
      const sourceEnd = lineOffset(oldLines, oldIndex + raw.oldLines)
      return {
        id: 'hunk-' + index + '-' + raw.oldStart + '-' + raw.newStart,
        oldStartLine: raw.oldStart,
        oldLineCount: raw.oldLines,
        newStartLine: raw.newStart,
        newLineCount: raw.newLines,
        lines: raw.lines,
        resolution: 'pending',
        lineChanges,
        sourceSnapshot: oldText,
        sourceStart,
        sourceEnd,
        sourceQuote: oldText.slice(sourceStart, sourceEnd),
        replacementText: newLines.slice(newIndex, newIndex + raw.newLines).join(''),
      }
    })
    return { hunks, stats }
  }

  private static enrichWordTokens(changes: DiffLineChange[]): void {
    const removed = changes.filter((line) => line.type === 'removed')
    const added = changes.filter((line) => line.type === 'added')
    for (let i = 0; i < Math.min(removed.length, added.length); i++) {
      const oldTokens: DiffWordToken[] = []
      const newTokens: DiffWordToken[] = []
      for (const part of Diff.diffWordsWithSpace(removed[i].content, added[i].content)) {
        if (part.added) newTokens.push({ type: 'added', value: part.value })
        else if (part.removed) oldTokens.push({ type: 'removed', value: part.value })
        else {
          oldTokens.push({ type: 'unchanged', value: part.value })
          newTokens.push({ type: 'unchanged', value: part.value })
        }
      }
      removed[i].wordTokens = oldTokens
      added[i].wordTokens = newTokens
    }
  }

  static applyHunks(
    oldText: string,
    hunks: Array<{
      lines: string[]
      resolution: HunkResolution
      oldStartLine?: number
      sourceSnapshot?: string
      sourceStart?: number
      sourceEnd?: number
      sourceQuote?: string
      replacementText?: string
    }>,
  ): string {
    const selected = hunks
      .filter((h) => h.resolution === 'applied')
      .sort((a, b) => (a.sourceStart ?? -1) - (b.sourceStart ?? -1))
    let result = ''
    let cursor = 0
    for (const hunk of selected) {
      const { sourceStart: start, sourceEnd: end } = hunk
      if (
        hunk.sourceSnapshot !== oldText ||
        !Number.isInteger(start) ||
        !Number.isInteger(end) ||
        start! < cursor ||
        end! < start! ||
        end! > oldText.length ||
        oldText.slice(start, end) !== hunk.sourceQuote ||
        typeof hunk.replacementText !== 'string'
      ) {
        throw new Error('修订来源已变化或缺少精确位置，请重新计算差异。')
      }
      result += oldText.slice(cursor, start) + hunk.replacementText
      cursor = end!
    }
    return result + oldText.slice(cursor)
  }
}
