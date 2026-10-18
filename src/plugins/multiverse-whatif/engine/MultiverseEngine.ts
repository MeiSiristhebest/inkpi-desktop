import type {
  MultiverseBranchRecord,
  MultiverseSimulationResult,
  ButterflyEffectLog,
} from '../types'
import type { MultiverseNode } from '../../../ports/multiverseRepository'
export interface CanonChapter {
  index: number
  title: string
  summary: string
  entities: string[]
  chapterId?: string
  chapterRevision?: number
  stateFacts?: string[]
}
export interface BranchEvent {
  chapterIndex: number
  eventSummary: string
  assumptions?: string[]
  consequences?: string[]
  affectedCharacters?: string[]
  stateFacts?: string[]
  premiseLink?: string
}

export class MultiverseEngine {
  static simulateFork(
    canonChapters: CanonChapter[],
    forkChapterIndex: number,
    divergencePremise: string,
    branchEvents: BranchEvent[] = [],
  ): MultiverseSimulationResult {
    if (!Number.isInteger(forkChapterIndex) || forkChapterIndex < 1 || !divergencePremise.trim())
      throw new Error('请选择实际分歧章节并填写假设。')
    if (
      canonChapters.some((c) => !Number.isInteger(c.index) || c.index < 1) ||
      new Set(canonChapters.map((c) => c.index)).size !== canonChapters.length
    )
      throw new Error('主线章序必须为唯一的正整数。')
    if (!canonChapters.some((c) => c.index === forkChapterIndex))
      throw new Error('分歧点不在提供的主线中。')
    if (
      new Set(branchEvents.map((e) => e.chapterIndex)).size !== branchEvents.length ||
      branchEvents.some(
        (e) =>
          e.chapterIndex < forkChapterIndex ||
          !canonChapters.some((c) => c.index === e.chapterIndex),
      )
    )
      throw new Error('分支事件章序重复、位于分歧点之前或不在主线范围中。')
    const chapters = [...canonChapters].sort((a, b) => a.index - b.index)
    const nodes: MultiverseNode[] = []
    const butterflyEffects: ButterflyEffectLog[] = []
    for (const chapter of chapters) {
      const inherited = chapter.index < forkChapterIndex
      const event = branchEvents.find((e) => e.chapterIndex === chapter.index)
      let difference: number | null = inherited ? 0 : null
      if (event?.stateFacts && chapter.stateFacts) {
        const canonical = new Set(chapter.stateFacts)
        const proposed = new Set(event.stateFacts)
        const union = new Set([...canonical, ...proposed]).size
        const intersection = [...canonical].filter((fact) => proposed.has(fact)).length
        difference = union ? 1 - intersection / union : null
      }
      const consequences = event?.consequences?.filter(Boolean) ?? []
      nodes.push({
        chapterIndex: chapter.index,
        chapterTitle: chapter.title,
        sourceChapterId: chapter.chapterId,
        sourceRevision: chapter.chapterRevision,
        canonSummary: chapter.summary,
        eventSummary: inherited
          ? chapter.summary
          : event?.eventSummary.trim() ||
            (chapter.index === forkChapterIndex
              ? '假设变更：' + divergencePremise
              : '分支事件尚未提供。'),
        divergenceLevel: difference,
        butterflyEffects: consequences,
        status: inherited
          ? 'inherited'
          : event?.eventSummary.trim() || chapter.index === forkChapterIndex
            ? 'hypothesis'
            : 'unplanned',
        assumptions: event?.assumptions ?? [],
        premiseLink: event?.premiseLink ?? '',
        stateDifferenceMethod:
          difference === null ? undefined : inherited ? 'inherited' : 'author-fact-set-jaccard',
      })
      if (consequences.length)
        butterflyEffects.push({
          chapterIndex: chapter.index,
          rippleFactor: null,
          description: consequences.join('；'),
          affectedCharacters: event?.affectedCharacters ?? [],
        })
    }
    return {
      branchId: 'branch_' + forkChapterIndex,
      branchName: '分支假设：' + divergencePremise.slice(0, 30),
      divergencePremise,
      forkChapterIndex,
      nodes,
      butterflyEffects,
      divergenceCurve: nodes.map((n) => ({
        chapter: n.chapterIndex,
        divergencePercent: n.divergenceLevel === null ? null : n.divergenceLevel * 100,
      })),
      suppliedChapterCount: chapters.length,
    }
  }
  static createBranchRecord(
    id: string,
    projectId: string,
    sim: MultiverseSimulationResult,
    createdAt: number,
  ): MultiverseBranchRecord {
    return {
      id,
      projectId,
      name: sim.branchName,
      forkChapterIndex: sim.forkChapterIndex,
      divergencePremise: sim.divergencePremise,
      nodes: structuredClone(sim.nodes),
      createdAt,
      schemaVersion: 2,
    }
  }
}
