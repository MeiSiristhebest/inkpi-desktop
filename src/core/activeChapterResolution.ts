import type { ChapterRecord } from '../types'
import type { ActiveWritingContext } from './activeWritingContext'

/**
 * P1.1: the editor's active chapter is the only authoritative pointer. Projecting it onto the
 * stored list keeps consumers on the chapter the writer is looking at; a pointer that cannot be
 * resolved yields null instead of a guessed chapter, so a plugin can never mutate the wrong one.
 */
export function resolveActiveChapter(
  chapters: readonly ChapterRecord[],
  writing?: ActiveWritingContext['chapter'],
): ChapterRecord | null {
  if (!writing) return null
  const stored = chapters.find((chapter) => chapter.id === writing.id)
  if (!stored) return null
  return {
    ...stored,
    content: writing.content,
    wordCount: writing.wordCount,
    revision: writing.revision,
  }
}
