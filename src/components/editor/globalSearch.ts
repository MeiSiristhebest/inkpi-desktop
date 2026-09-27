import { htmlToPlain } from '../../domain/text'
import type { ChapterRecord } from '../../types'
import type { TimelineNode } from '../../plugins/timeline-grid/types'

export type GlobalHitKind = 'chapter-title' | 'chapter-content' | 'timeline-event'

/** 两个呈现面（浮层 / 查找栏内联面板）共用同一份来源标签。 */
export const GLOBAL_HIT_LABEL: Record<GlobalHitKind, string> = {
  'chapter-title': '标题',
  'chapter-content': '正文',
  'timeline-event': '时间线',
}

export interface GlobalSearchHit {
  kind: GlobalHitKind
  /** 结果落点：正文/标题命中就是这一章，时间线命中是它挂在第几章。 */
  chapterId: string
  title: string
  /** 标题命中没有上下文可摘，留空由视图改标成「标题命中」。 */
  snippet: string
  count: number
}

const SNIPPET_RADIUS = 24
const SNIPPET_LENGTH = 64

function countOccurrences(lower: string, term: string): number {
  let index = lower.indexOf(term)
  if (index === -1) return 0
  let count = 0
  while (index !== -1) {
    count += 1
    index = lower.indexOf(term, index + term.length)
  }
  return count
}

/** 位置在 lower 上找，切片切原文，摘出来的片段才保留作者写的中英大小写。 */
function snippetAround(original: string, lower: string, term: string): string {
  const start = Math.max(0, lower.indexOf(term) - SNIPPET_RADIUS)
  return original
    .substring(start, start + SNIPPET_LENGTH)
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 全书检索的扇出：同一个浮层里给出正文、章节标题、时间线事件三类命中，每一条都落在可跳转的章节上。
 * 设定实体不在这里出现 —— 编辑器没有任何 API 能把某个实体定位出来，列出跳不到的结果是假功能。
 */
export function collectGlobalSearchHits(
  projectId: string,
  chapters: readonly ChapterRecord[],
  nodes: readonly TimelineNode[],
  query: string,
): GlobalSearchHit[] {
  const term = query.trim().toLowerCase()
  if (!term) return []

  const hits: GlobalSearchHit[] = []
  const chapterIdByOrder = new Map<number, string>()

  for (const chapter of chapters) {
    const title = chapter.title.toLowerCase()
    const titleMatches = countOccurrences(title, term)
    if (titleMatches) {
      hits.push({
        kind: 'chapter-title',
        chapterId: chapter.id,
        title: chapter.title,
        snippet: '',
        count: titleMatches,
      })
    }

    const body = htmlToPlain(chapter.content || '')
    const bodyMatches = countOccurrences(body.toLowerCase(), term)
    if (bodyMatches) {
      hits.push({
        kind: 'chapter-content',
        chapterId: chapter.id,
        title: chapter.title,
        snippet: snippetAround(body, body.toLowerCase(), term),
        count: bodyMatches,
      })
    }

    if (!chapterIdByOrder.has(chapter.order)) chapterIdByOrder.set(chapter.order, chapter.id)
  }

  for (const node of nodes) {
    // getAllNodes() 拿的是整个存储，不按 workspace 过滤就会把别部书的大纲事件搜进来（INV-03）。
    if (node.projectId !== projectId) continue
    const eventText = `${node.eventTitle} ${node.summary}`
    const lower = eventText.toLowerCase()
    const matches = countOccurrences(lower, term)
    if (!matches) continue
    const chapterId = chapterIdByOrder.get(node.chapterOrder)
    if (!chapterId) continue
    hits.push({
      kind: 'timeline-event',
      chapterId,
      title: node.eventTitle,
      snippet: snippetAround(eventText, lower, term),
      count: matches,
    })
  }

  return hits.sort((a, b) => b.count - a.count)
}
