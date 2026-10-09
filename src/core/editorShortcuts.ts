import {
  commandRegistry,
  EDITOR_SHORTCUT_COMMAND_IDS,
  matchesShortcut,
  type Command,
  type EditorShortcutId,
} from './commandRegistry'

export type { EditorShortcutId } from './commandRegistry'

export function isEditorShortcutId(value: string): value is EditorShortcutId {
  return Object.prototype.hasOwnProperty.call(EDITOR_SHORTCUT_COMMAND_IDS, value)
}

export function getEditorShortcut(id: EditorShortcutId): Command & { shortcut: string } {
  const command = commandRegistry.get(EDITOR_SHORTCUT_COMMAND_IDS[id])
  if (!command?.shortcut) throw new Error(`Unknown editor shortcut: ${id}`)
  return command as Command & { shortcut: string }
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
