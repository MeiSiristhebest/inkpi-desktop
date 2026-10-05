import { matchesShortcut } from './commandRegistry'

/**
 * 快捷键的唯一权威来源。`shortcut` 用 `Mod+…` 记法，与 commandRegistry 共用同一个解析器，
 * 因此「实际监听的键」与「界面上印出来的键」不可能各说一套。
 *
 * 展示文案一律由 formatShortcutLabel 派生：调用点不再手写「⌘B」这类字符串——那既是 macOS 字形
 * （本产品只发布 Windows），又会与真实绑定漂移。加粗/倾斜/撤销/重做由 Tiptap StarterKit 的
 * keymap 绑定，列在这里是为了让工具栏标题与速查表读同一份数据。
 */
export const EDITOR_SHORTCUTS = [
  { id: 'commandPalette', action: '命令面板', shortcut: 'Mod+K' },
  { id: 'saveChapter', action: '保存章节', shortcut: 'Mod+S' },
  { id: 'newChapter', action: '新建章节', shortcut: 'Mod+N' },
  { id: 'findReplace', action: '查找替换', shortcut: 'Mod+F' },
  { id: 'toggleChapterTree', action: '切换章节树', shortcut: 'Mod+\\' },
  { id: 'history', action: '打开历史记录', shortcut: 'Mod+H' },
  { id: 'renameChapter', action: '重命名当前章节', shortcut: 'F2' },
  { id: 'previousChapter', action: '上一章', shortcut: 'Alt+ArrowUp' },
  { id: 'nextChapter', action: '下一章', shortcut: 'Alt+ArrowDown' },
  { id: 'bold', action: '加粗', shortcut: 'Mod+B' },
  { id: 'italic', action: '倾斜', shortcut: 'Mod+I' },
  { id: 'undo', action: '撤销', shortcut: 'Mod+Z' },
  { id: 'redo', action: '重做', shortcut: 'Shift+Mod+Z' },
] as const

export type EditorShortcutId = (typeof EDITOR_SHORTCUTS)[number]['id']

export function getEditorShortcut(id: EditorShortcutId): (typeof EDITOR_SHORTCUTS)[number] {
  const shortcut = EDITOR_SHORTCUTS.find((candidate) => candidate.id === id)
  if (!shortcut) throw new Error(`Unknown editor shortcut: ${id}`)
  return shortcut
}

export function matchesEditorShortcut(
  id: EditorShortcutId,
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>,
): boolean {
  return matchesShortcut(getEditorShortcut(id).shortcut, event)
}

const MODIFIER_LABELS: Record<string, string> = {
  mod: 'Ctrl',
  ctrl: 'Ctrl',
  shift: 'Shift',
  alt: 'Alt',
  meta: 'Win',
  cmd: 'Win',
}

const KEY_LABELS: Record<string, string> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
}

/** 把 `Mod+Z` / `Shift+Mod+Z` 这类记法渲染成界面文案；本产品只发布 Windows，故 Mod 固定为 Ctrl。 */
export function formatShortcutLabel(shortcut: string): string {
  const parts = shortcut
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
  const key = parts.at(-1) ?? ''
  const modifiers = [
    ...new Set(
      parts.slice(0, -1).map((part) => MODIFIER_LABELS[part.toLowerCase()] ?? part.toUpperCase()),
    ),
  ]
  const keyLabel = KEY_LABELS[key] ?? key.toUpperCase()
  return [...modifiers, keyLabel].join(' + ')
}

export function shortcutLabel(id: EditorShortcutId): string {
  return formatShortcutLabel(getEditorShortcut(id).shortcut)
}

/** 工具栏与菜单 title 的统一写法：`折叠目录 (Ctrl + \)`。 */
export function shortcutHint(label: string, id: EditorShortcutId): string {
  return `${label} (${shortcutLabel(id)})`
}
