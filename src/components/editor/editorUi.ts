import type { ChapterStatus } from '../../types'

/** 章节状态选项（颜色统一走 var(--ink-*) 令牌，禁止硬编码 hex，§1.5） */
export const STATUS_OPTIONS: { value: ChapterStatus; label: string; color: string }[] = [
  { value: 'draft', label: '草稿', color: 'var(--ink-text-faint)' },
  { value: 'review', label: '审阅中', color: 'var(--ink-warning)' },
  { value: 'published', label: '已发布', color: 'var(--ink-success)' },
  { value: 'archived', label: '已归档', color: 'var(--ink-text-muted)' },
]

// 通用图标按钮样式已统一收敛到 ui/atoms/IconButton（§10.2）；编辑器各 organisms 直接复用该原子，
// 不再于本文件维护重复的样式字符串。
