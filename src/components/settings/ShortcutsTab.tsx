import type { FC } from 'react'
import { commandRegistry } from '../../core/commandRegistry'
import { EDITOR_SHORTCUTS } from '../../core/editorShortcuts'
import { Section } from './SettingsShared'

export const ShortcutsTab: FC = () => {
  const commandItems = commandRegistry
    .getAll()
    .filter((command) => command.shortcut)
    .map((command) => ({ action: command.title, key: command.shortcut! }))
  const editorShortcutItems = EDITOR_SHORTCUTS.map(({ action, display }) => ({
    action,
    key: display,
  }))
  const shortcutItems = [...editorShortcutItems, ...commandItems]

  return (
    <Section title="快捷键速查" desc="以下列表只展示当前编辑器与命令注册表实际监听的快捷键。">
      <div aria-label="快捷键列表" className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {shortcutItems.map((item) => (
          <div
            key={`${item.action}-${item.key}`}
            className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] text-xs"
          >
            <span className="text-[var(--ink-text)] font-medium">{item.action}</span>
            <kbd className="px-2 py-0.5 rounded-md bg-[var(--ink-bg)] border border-[var(--ink-border)] text-[var(--ink-text-muted)] font-mono text-[11px] shadow-2xs">
              {item.key}
            </kbd>
          </div>
        ))}
      </div>
    </Section>
  )
}
