import { matchesShortcut } from './commandRegistry'

export const EDITOR_SHORTCUTS = [
  { id: 'commandPalette', action: '命令面板', shortcut: 'Mod+K', display: 'Mod + K' },
  { id: 'saveChapter', action: '保存章节', shortcut: 'Mod+S', display: 'Mod + S' },
  { id: 'newChapter', action: '新建章节', shortcut: 'Mod+N', display: 'Mod + N' },
  { id: 'findReplace', action: '查找替换', shortcut: 'Mod+F', display: 'Mod + F' },
  { id: 'toggleChapterTree', action: '切换章节树', shortcut: 'Mod+\\', display: 'Mod + \\' },
  { id: 'history', action: '打开历史记录', shortcut: 'Mod+H', display: 'Mod + H' },
  { id: 'renameChapter', action: '重命名当前章节', shortcut: 'F2', display: 'F2' },
  { id: 'previousChapter', action: '上一章', shortcut: 'Alt+ArrowUp', display: 'Alt + ↑' },
  { id: 'nextChapter', action: '下一章', shortcut: 'Alt+ArrowDown', display: 'Alt + ↓' },
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
