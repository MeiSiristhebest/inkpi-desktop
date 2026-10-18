import type { EntitySearchResult } from '../types'
import type { CodexEntity } from '../../living-codex/types'
import type { ChapterRecord, VolumeRecord } from '../../../types'
import { projectSemanticTextFields, semanticTextFromContent } from '../../../domain/content'
import type { EntityOccurrence } from '../../../ports/memoryPalaceRepository'

export class MemoryPalaceWorkspaceIndex {
  private readonly chapters = new Map<string, ChapterRecord>()
  private volumes: VolumeRecord[] | undefined
  readonly workspaceId: string
  constructor(workspaceId: string) {
    this.workspaceId = workspaceId
  }
  setVolumes(volumes: VolumeRecord[]): void {
    this.volumes = structuredClone(volumes.filter((v) => v.projectId === this.workspaceId))
  }
  update(chapter: ChapterRecord): void {
    if (chapter.projectId === this.workspaceId)
      this.chapters.set(chapter.id, structuredClone(chapter))
  }
  updateMany(chapters: readonly ChapterRecord[]): void {
    for (const chapter of chapters) this.update(chapter)
  }
  remove(id: string): void {
    this.chapters.delete(id)
  }
  clear(): void {
    this.chapters.clear()
  }
  get size(): number {
    return this.chapters.size
  }
  snapshot(): ChapterRecord[] {
    return structuredClone([...this.chapters.values()])
  }
  search(query: string, entities: CodexEntity[]): EntitySearchResult[] {
    return MemoryPalaceEngine.searchEntityOccurrences({
      query,
      entities,
      chapters: this.snapshot(),
      volumes: this.volumes,
      projectId: this.workspaceId,
    })
  }
}

export class MemoryPalaceEngine {
  static searchEntityOccurrences(params: {
    query: string
    entities: CodexEntity[]
    chapters: ChapterRecord[]
    volumes?: VolumeRecord[]
    projectId?: string
  }): EntitySearchResult[] {
    const semanticParams = projectSemanticTextFields(params) as typeof params
    const { query, volumes, projectId } = semanticParams
    const needle = query.trim().toLocaleLowerCase()
    const chapters = semanticParams.chapters.filter((c) => !projectId || c.projectId === projectId)
    const volumeOrder = new Map(volumes?.map((v) => [v.id, v.order]))
    const ordered = [...chapters].sort(
      (a, b) =>
        (volumeOrder.get(a.volumeId) ?? Infinity) - (volumeOrder.get(b.volumeId) ?? Infinity) ||
        a.order - b.order ||
        a.id.localeCompare(b.id),
    )
    const positions = new Map<string, number>()
    const known = volumes
      ? ordered.filter((c) => volumeOrder.has(c.volumeId))
      : new Set(ordered.map((c) => c.volumeId)).size <= 1
        ? ordered
        : []
    known.forEach((c, i) => positions.set(c.id, i + 1))
    const entities = semanticParams.entities
      .filter((e) => !projectId || e.projectId === projectId)
      .filter(
        (e) =>
          !needle ||
          [e.name, ...(e.aliases ?? []), e.summary ?? ''].some((t) =>
            t.toLocaleLowerCase().includes(needle),
          ),
      )
    const results: EntitySearchResult[] = []
    for (const entity of entities) {
      const terms = [
        ...new Set([entity.name, ...(entity.aliases ?? [])].filter((t) => t.trim().length > 0)),
      ]
      const occurrences: EntityOccurrence[] = []
      for (const chapter of ordered) {
        const text = semanticTextFromContent(chapter.id, chapter.content ?? '', chapter.revision)
        const hits: Array<{ start: number; end: number; term: string }> = []
        for (const term of terms) {
          let cursor = 0
          while (cursor <= text.length - term.length) {
            const start = text.indexOf(term, cursor)
            if (start < 0) break
            hits.push({ start, end: start + term.length, term })
            cursor = start + term.length
          }
        }
        hits.sort((a, b) => a.start - b.start || b.end - a.end)
        let previousEnd = -1
        for (const hit of hits) {
          if (hit.start < previousEnd) continue
          previousEnd = hit.end
          const snippetStart = Math.max(0, hit.start - 30)
          const snippetEnd = Math.min(text.length, hit.end + 30)
          occurrences.push({
            chapterId: chapter.id,
            chapterTitle: chapter.title,
            chapterOrder: positions.get(chapter.id),
            snippet: text.slice(snippetStart, snippetEnd),
            offset: hit.start,
            sourceQuote: text.slice(hit.start, hit.end),
            sourceStart: hit.start,
            sourceEnd: hit.end,
            snippetStart,
            snippetEnd,
            matchedTerm: hit.term,
            chapterRevision: chapter.revision,
          })
        }
      }
      const first = occurrences[0]
      const last = occurrences.at(-1)
      results.push({
        entityId: entity.id,
        entityName: entity.name,
        category: entity.category,
        aliases: entity.aliases ?? [],
        matchKind:
          entity.name.toLocaleLowerCase() === needle
            ? 'exact_name'
            : entity.aliases?.some((a) => a.toLocaleLowerCase() === needle)
              ? 'exact_alias'
              : 'contains',
        totalOccurrences: occurrences.length,
        matchedChapterCount: new Set(occurrences.map((o) => o.chapterId)).size,
        indexedChapterCount: ordered.length,
        occurrences,
        firstAppearedChapter: first
          ? { id: first.chapterId, title: first.chapterTitle, order: first.chapterOrder }
          : undefined,
        lastAppearedChapter: last
          ? { id: last.chapterId, title: last.chapterTitle, order: last.chapterOrder }
          : undefined,
        recentSnippets: occurrences
          .slice(-3)
          .map(
            (o) =>
              '[' +
              (o.chapterOrder ? '第' + o.chapterOrder + '章 ' : '章序未知 ') +
              o.chapterTitle +
              '] ' +
              o.snippet,
          ),
      })
    }
    const rank = { exact_name: 0, exact_alias: 1, contains: 2 }
    return results.sort(
      (a, b) =>
        rank[a.matchKind!] - rank[b.matchKind!] ||
        b.totalOccurrences - a.totalOccurrences ||
        a.entityId.localeCompare(b.entityId),
    )
  }

  static detectEntitiesInText(text: string, entities: CodexEntity[]): CodexEntity[] {
    return entities.filter((e) =>
      [e.name, ...(e.aliases ?? [])].some((t) => t.trim() && text.includes(t)),
    )
  }
}
