import type { Editor } from '@tiptap/react'
import type { ChapterRecord } from '../../types'
import { chapterMutationService } from '../../services/defaultChapterMutationService'
import type { ChapterMutationOrigin } from '../../services/chapterMutationService'
import { draftJournal } from '../../services/draftJournal'

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
  editor.commands.setContent(content || '', { emitUpdate: false })
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
  // The journal is cleared after every durable save, so anything still recorded
  // here is typing that never reached the database. Replacing content without
  // draining it first would discard that manuscript text (INV-01), and skipping
  // the drain when it conflicts would overwrite it with the new content.
  const pending = draftJournal.get(options.workspaceId, options.chapterId)
  let expectedRevision = options.expectedRevision
  if (pending && pending.editorContent !== newContent) {
    const drained = await chapterMutationService.mutate({
      workspaceId: options.workspaceId,
      chapterId: options.chapterId,
      expectedRevision: pending.baseRevision,
      mutation: { type: 'replace-content', content: pending.editorContent },
      origin: 'user-typing',
    })
    if (!drained.success) {
      console.warn('[applyContentMutation] Pending draft recovery rejected:', drained.error)
      return null
    }
    expectedRevision = drained.newRevision
  }

  const result = await chapterMutationService.mutate({
    workspaceId: options.workspaceId,
    chapterId: options.chapterId,
    expectedRevision,
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
    editor.commands.setContent(result.chapter.content || '', { emitUpdate: false })
  }

  return result.chapter
}
