import { countStoryRecords, type StoryState } from '../../domain/story'
import type { ActiveWritingContext } from '../../core/activeWritingContext'

/**
 * 发送前的请求范围披露（P3.15）。
 *
 * 披露必须与实际 payload 同源：滚动历史轮数上限由这里持有，
 * sendAiPrompt 切片与面板文案都引用同一个常量，否则"最近 N 条"会各自漂移。
 */
export const ASSISTANT_HISTORY_TURN_LIMIT = 6

export interface AssistantRequestScope {
  hasChapter: boolean
  chapterTitle: string | null
  selectionChars: number
  storyFactCount: number
  historyTurns: number
}

export interface AssistantRequestScopeSource {
  /** 从权威的活动写作上下文派生：字段改名会让这里编译失败，而不是悄悄少披露一项 */
  chapter?: Pick<NonNullable<ActiveWritingContext['chapter']>, 'title' | 'content'>
  selection?: Pick<NonNullable<ActiveWritingContext['selection']>, 'from' | 'to'>
  storyState?: StoryState
  historyMessages: readonly unknown[]
}

export function projectAssistantRequestScope(
  source: AssistantRequestScopeSource,
): AssistantRequestScope {
  const length = source.chapter?.content.length ?? 0
  return {
    hasChapter: Boolean(source.chapter),
    chapterTitle: source.chapter?.title ?? null,
    selectionChars: source.selection
      ? clippedSpan(source.selection.from, source.selection.to, length)
      : 0,
    storyFactCount: countStoryRecords(source.storyState),
    historyTurns: Math.min(source.historyMessages.length, ASSISTANT_HISTORY_TURN_LIMIT),
  }
}

export function formatAssistantRequestScope(scope: AssistantRequestScope): string {
  const parts = [
    scope.hasChapter && scope.chapterTitle ? `当前章节《${scope.chapterTitle}》` : '你输入的指令',
  ]
  if (scope.selectionChars > 0) parts.push('选中文本')
  parts.push(`设定 ${scope.storyFactCount} 项`)
  if (scope.historyTurns > 0) parts.push(`上文 ${scope.historyTurns} 条对话`)
  return `本次请求将发送：${parts.join(' · ')}`
}

function clippedSpan(from: number, to: number, length: number): number {
  const start = Math.max(0, Math.min(length, from))
  const end = Math.max(start, Math.min(length, to))
  return end - start
}
