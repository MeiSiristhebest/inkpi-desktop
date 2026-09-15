import type { Editor } from '@tiptap/react'
import type { ChapterRecord } from '../../types'
import { chapterMutationService } from '../../services/defaultChapterMutationService'
import type { ChapterMutationOrigin } from '../../services/chapterMutationService'

export interface ApplyMutationOptions {
  workspaceId: string
  chapterId: string
  expectedRevision?: number
  origin: ChapterMutationOrigin
  countAsAuthorWriting?: boolean
  createHistorySnapshot?: boolean
  triggerContinuityAudit?: boolean
}

/**
 * 仅用于只读灌入编辑器（例如：切换章节、外部已有耐久数据同步到视口）
 * 绝不触发二次存盘，不生成 DomainChange，不改变 durable state。
 */
export function loadContentIntoEditor(editor: Editor | null, content: string): void {
  if (!editor || editor.isDestroyed) return
  editor.commands.setContent(content || '', false)
}

/**
 * 用户或业务发起的正文变更（例如：格式化、历史恢复、敏感词替换、AI改写采纳等）
 * 必须经由唯一的权威事实源 ChapterMutationService 原子落盘与更新 (INV-02)。
 */
export async function applyContentMutation(
  editor: Editor | null,
  newContent: string,
  options: ApplyMutationOptions,
): Promise<ChapterRecord | null> {
  const result = await chapterMutationService.mutate({
    workspaceId: options.workspaceId,
    chapterId: options.chapterId,
    expectedRevision: options.expectedRevision,
    mutation: { type: 'replace-content', content: newContent },
    origin: options.origin,
    countAsAuthorWriting: options.countAsAuthorWriting,
    createHistorySnapshot: options.createHistorySnapshot,
    triggerContinuityAudit: options.triggerContinuityAudit,
  })

  if (!result.success) {
    console.warn('[applyContentMutation] Mutation rejected:', result.error)
    return null
  }

  if (editor && !editor.isDestroyed) {
    editor.commands.setContent(result.chapter.content || '', false)
  }

  return result.chapter
}
