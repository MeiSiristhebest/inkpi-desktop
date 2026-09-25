import type { ChapterRecord } from '../../types'
import { projectContent } from '../../domain/content'
import { buildDurableTaskId } from '../../types/durableTaskId'
import { CREATIVE_ARTIFACT_TYPES } from '../artifacts'
import { chapterMutationService } from '../../services/defaultChapterMutationService'
import type { ChapterMutationService } from '../../services/chapterMutationService'
import type {
  DistillationWorkflowOptions,
  DistillationWorkflowResult,
  ProjectDistillationInput,
} from './verticalSlices'

/**
 * Runtime 侧的 JIT L2「近期摘要」层只读 `documents.synopsis`，而这个槽位此前没有任何生产者，
 * 于是跨章节记忆静默退化成 L1 实体匹配。这里把「单章摘要」任务与权威章节写入接成一条链。
 */
export type ChapterDistillationRunner = (
  input: ProjectDistillationInput,
  options?: DistillationWorkflowOptions,
) => Promise<DistillationWorkflowResult | null>

export interface GenerateChapterSynopsisInput {
  workspaceId: string
  chapter: ChapterRecord
  signal?: AbortSignal
}

export interface GenerateChapterSynopsisDependencies {
  runDistillation: ChapterDistillationRunner
  mutationService?: ChapterMutationService
}

export type GenerateChapterSynopsisResult =
  | { success: true; synopsis: string; revision: number; unchanged: boolean }
  | { success: false; conflict: boolean; error: string; currentRevision?: number }

/**
 * 文档级摘要任务：一次 distillation 只覆盖本章，产物固定为 creative.chapter-summary，
 * 任务 id 由章节 revision 派生，因此正文未变时重跑会命中同一缓存与同一梗概。
 */
export function chapterSynopsisDistillationInput(
  chapter: ChapterRecord,
  workspaceId: string,
): ProjectDistillationInput {
  const document = projectContent(chapter.id, chapter.content || '', chapter.revision ?? 0)
  return {
    taskId: buildDurableTaskId({
      workspaceId,
      operation: 'chapter-synopsis',
      sourceFingerprint: `r${document.revision}`,
      instance: chapter.id,
    }),
    workspaceId,
    documents: [document],
    target: 'document',
    fields: ['summary'],
    metadata: { artifactType: CREATIVE_ARTIFACT_TYPES.chapterSummary },
    instruction: '用 60-120 字概括本章已经发生的剧情与结尾状态，用于后续章节的记忆检索。',
  }
}

export async function generateChapterSynopsis(
  input: GenerateChapterSynopsisInput,
  dependencies: GenerateChapterSynopsisDependencies,
): Promise<GenerateChapterSynopsisResult> {
  const { workspaceId, chapter } = input
  const request = chapterSynopsisDistillationInput(chapter, workspaceId)
  if (!request.documents[0]?.text.trim()) {
    return { success: false, conflict: false, error: '本章还没有正文，无法生成梗概' }
  }

  const workflow = await dependencies.runDistillation(request, {
    chunkSize: 1,
    ...(input.signal ? { signal: input.signal } : {}),
  })
  const synopsis = (workflow?.facts.summary ?? '').trim()
  if (!synopsis) {
    return { success: false, conflict: false, error: '摘要任务没有返回可用的梗概文本' }
  }

  const result = await (dependencies.mutationService ?? chapterMutationService).mutate({
    workspaceId,
    chapterId: chapter.id,
    expectedRevision: chapter.revision,
    mutation: { type: 'update-synopsis', synopsis },
    origin: 'ai-rewrite',
  })
  if (!result.success) {
    return {
      success: false,
      conflict: result.conflict,
      error: result.error,
      ...(result.currentRevision === undefined ? {} : { currentRevision: result.currentRevision }),
    }
  }
  return {
    success: true,
    synopsis,
    revision: result.newRevision,
    unchanged: result.newRevision === result.previousRevision,
  }
}
