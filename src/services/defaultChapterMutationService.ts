import type { ChapterRecord } from '../types'
import type { ProjectRepository } from '../ports/projectRepository'
import type { Clock } from '../ports/clock'
import { indexedDbProjectRepository } from '../adapters/indexedDbProjectRepository'
import { clock } from '../adapters/clock'
import { countWords } from '../domain/text'
import { chapterSaveEvents } from '../ports/chapterSaveEvents'
import { draftJournal } from './draftJournal'
import type {
  ChapterMutationCommand,
  ChapterMutationExecutionResult,
  ChapterMutationService,
} from './chapterMutationService'

export class DefaultChapterMutationService implements ChapterMutationService {
  readonly projectRepo: ProjectRepository
  readonly clockPort: Clock

  constructor(
    projectRepo: ProjectRepository = indexedDbProjectRepository,
    clockPort: Clock = clock,
  ) {
    this.projectRepo = projectRepo
    this.clockPort = clockPort
  }

  async mutate(command: ChapterMutationCommand): Promise<ChapterMutationExecutionResult> {
    const { workspaceId, chapterId, expectedRevision, mutation } = command

    // 1. Fetch current authoritative chapter record
    let existing: ChapterRecord | undefined
    if (typeof this.projectRepo.getChaptersByProject === 'function') {
      const chapters = await this.projectRepo.getChaptersByProject(workspaceId)
      existing = chapters.find((c) => c.id === chapterId)
    }
    // Fallback if caller mocked partially or provides only activeChapter context
    if (
      !existing &&
      command.activeChapterFallback &&
      command.activeChapterFallback.id === chapterId
    ) {
      existing = command.activeChapterFallback
    }

    if (!existing) {
      return {
        success: false,
        conflict: false,
        error: `Chapter not found: id '${chapterId}' in workspace '${workspaceId}'`,
      }
    }

    const currentRevision = existing.revision ?? 1

    // 2. CAS Validation
    if (expectedRevision !== undefined && expectedRevision !== currentRevision) {
      return {
        success: false,
        conflict: true,
        currentRevision,
        error: `CAS Conflict: expected revision ${expectedRevision}, but current revision is ${currentRevision}`,
      }
    }

    // 3. Compute new content & title
    let newContent = existing.content || ''
    let newTitle = existing.title

    if (mutation.type === 'replace-content') {
      newContent = mutation.content
    } else if (mutation.type === 'patch-range') {
      const { from, to, content } = mutation
      const clampedFrom = Math.max(0, Math.min(from, newContent.length))
      const clampedTo = Math.max(clampedFrom, Math.min(to, newContent.length))
      newContent = newContent.slice(0, clampedFrom) + content + newContent.slice(clampedTo)
    } else if (mutation.type === 'update-title') {
      newTitle = mutation.title
    }

    const newRevision = currentRevision + 1
    const newWordCount = countWords(newContent)
    const previousWordCount = existing.wordCount ?? countWords(existing.content || '')
    const wordCountDelta = newWordCount - previousWordCount
    const now = this.clockPort.now()

    const updatedChapter: ChapterRecord = {
      ...existing,
      title: newTitle,
      content: newContent,
      wordCount: newWordCount,
      revision: newRevision,
      updatedAt: now,
    }

    // 4. Durable persistence (下沉至 repository 真正的 saveChapterCAS)
    try {
      if (typeof this.projectRepo.saveChapterCAS === 'function') {
        const casResult = await this.projectRepo.saveChapterCAS({
          chapter: updatedChapter,
          expectedRevision: currentRevision,
        })
        if (!casResult.success) {
          return {
            success: false,
            conflict: Boolean(casResult.conflict),
            currentRevision: casResult.currentRevision ?? currentRevision,
            error: casResult.error || 'Repository CAS 冲突',
          }
        }
      } else {
        await this.projectRepo.saveChapter(updatedChapter)
      }

      // 统计与归因策略：仅当显式标记或用户打字时，才记入作者个人每日码字量 (P0.1, P3.10)
      const countAsWriting = command.countAsAuthorWriting ?? origin === 'user-typing'
      if (countAsWriting && wordCountDelta > 0) {
        try {
          const { indexedDbDailyStatsRepository } =
            await import('../adapters/indexedDbDailyStatsRepository')
          await indexedDbDailyStatsRepository.recordDailyWords(workspaceId, wordCountDelta)
        } catch {
          // ignore stats error
        }
      }
    } catch (err) {
      return {
        success: false,
        conflict: false,
        currentRevision,
        error: `Persistence failure: ${err instanceof Error ? err.message : String(err)}`,
      }
    }

    // 5. Clear draft journal since durable save succeeded
    draftJournal.clear(workspaceId, chapterId)

    // 6. Emit chapterSaved event
    chapterSaveEvents.publish(updatedChapter)

    return {
      success: true,
      conflict: false,
      previousRevision: currentRevision,
      newRevision,
      chapter: updatedChapter,
      wordCountDelta,
    }
  }
}

export const chapterMutationService = new DefaultChapterMutationService()
