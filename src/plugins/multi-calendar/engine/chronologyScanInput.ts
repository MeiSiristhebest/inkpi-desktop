import { semanticTextFromContent } from '../../../domain/content'

export const MAX_CHRONOLOGY_SCAN_CHAPTERS = 15
export const MAX_CHRONOLOGY_SCAN_CHARACTERS_PER_CHAPTER = 250

export interface ChronologyScanChapter {
  id: string
  revision?: number
  order: number | null
  title: string
  content?: string
}

function sampleAcrossReadingOrder<T>(items: readonly T[], limit: number): T[] {
  if (limit <= 0) return []
  if (items.length <= limit) return [...items]
  if (limit === 1) return [items[0]]

  return Array.from({ length: limit }, (_, index) => {
    const sourceIndex = Math.round((index * (items.length - 1)) / (limit - 1))
    return items[sourceIndex]
  })
}

export function buildChronologyScanInput(chapters: readonly ChronologyScanChapter[]) {
  const candidates: Array<
    ChronologyScanChapter & { revision: number; text: string; excerpt: string }
  > = []

  for (const chapter of chapters) {
    const revision = chapter.revision ?? 1
    const text = semanticTextFromContent(chapter.id, chapter.content ?? '', revision)
    const candidate = {
      ...chapter,
      revision,
      text,
      excerpt: text.slice(0, MAX_CHRONOLOGY_SCAN_CHARACTERS_PER_CHAPTER),
    }

    if (candidate.text.trim().length > 0) candidates.push(candidate)
  }

  const samples = sampleAcrossReadingOrder(candidates, MAX_CHRONOLOGY_SCAN_CHAPTERS)
  const consideredChapterCount = chapters.length
  const emptyChapterCount = chapters.length - candidates.length
  const omittedChapterCount = candidates.length - samples.length
  const truncatedChapterCount = samples.filter(
    (chapter) => chapter.text.length > chapter.excerpt.length,
  ).length
  const complete =
    omittedChapterCount === 0 && emptyChapterCount === 0 && truncatedChapterCount === 0

  const input: Record<string, unknown> = {
    scanScope: {
      totalChapterCount: chapters.length,
      consideredChapterCount,
      sampledChapterCount: samples.length,
      omittedChapterCount,
      emptyChapterCount,
      chapterSampling: omittedChapterCount > 0 ? 'evenly-spaced' : 'all',
      perChapterCharacterLimit: MAX_CHRONOLOGY_SCAN_CHARACTERS_PER_CHAPTER,
      truncatedChapterCount,
      complete,
    },
  }

  samples.forEach((chapter, index) => {
    const sourceKey = `chapter:${chapter.id}@revision:${chapter.revision}:${index + 1}`
    const chapterPosition = chapter.order === null ? '章节位置未知' : `第 ${chapter.order} 章`
    input[sourceKey] = `${chapterPosition}《${chapter.title}》：\n${chapter.excerpt}`
  })

  const omissions = [
    omittedChapterCount > 0 ? `另有 ${omittedChapterCount} 章未提供（从全文范围均匀抽样）` : '',
    emptyChapterCount > 0 ? `${emptyChapterCount} 章没有可分析的正文` : '',
    truncatedChapterCount > 0
      ? `${truncatedChapterCount} 章只提供前 ${MAX_CHRONOLOGY_SCAN_CHARACTERS_PER_CHAPTER} 个字符`
      : '',
  ].filter(Boolean)
  const scopeLabel = complete
    ? `本次 AI 复核包含全部 ${samples.length} 章的正文。`
    : samples.length === 0
      ? '没有可分析的章节正文，无法发起 AI 排查。'
      : `本次 AI 复核仅包含 ${samples.length}/${chapters.length} 章；${omissions.join('；')}。结论只适用于已提供的内容，不代表完整时间线已通过。`

  return { input, sampledChapterCount: samples.length, scopeLabel }
}
