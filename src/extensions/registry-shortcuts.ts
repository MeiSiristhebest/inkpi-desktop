import { Extension, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { commandRegistry, EDITOR_SHORTCUT_COMMAND_IDS } from '../core/commandRegistry'

const extensionsWithRegistryKeymaps = new Set(['bold', 'italic', 'undoRedo'])

/** Keep StarterKit's formatting commands while routing their key bindings through CommandRegistry. */
export const RegistryStarterKit = StarterKit.extend({
  addExtensions() {
    const extensions = this.parent?.() ?? []
    return extensions.map((extension) => {
      if (!extensionsWithRegistryKeymaps.has(extension.name)) return extension
      return extension.extend({
        addKeyboardShortcuts: () => ({}),
      })
    })
  },
})

function toTiptapShortcut(shortcut: string): string {
  const parts = shortcut
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
  const key = parts.pop() ?? ''
  const modifiers = parts.map((part) => {
    switch (part.toLowerCase()) {
      case 'mod':
        return 'Mod'
      case 'ctrl':
        return 'Control'
      case 'meta':
      case 'cmd':
        return 'Meta'
      case 'alt':
      case 'option':
        return 'Alt'
      case 'shift':
        return 'Shift'
      default:
        return part
    }
  })
  return [...modifiers, key.length === 1 ? key.toLowerCase() : key].join('-')
}

const formattingShortcutIds = [
  EDITOR_SHORTCUT_COMMAND_IDS.bold,
  EDITOR_SHORTCUT_COMMAND_IDS.italic,
  EDITOR_SHORTCUT_COMMAND_IDS.undo,
  EDITOR_SHORTCUT_COMMAND_IDS.redo,
] as const

export function registerFormattingShortcutHandlers(editor: Editor): () => void {
  const handlers: Array<[string, () => void]> = [
    [
      EDITOR_SHORTCUT_COMMAND_IDS.bold,
      () => {
        editor.chain().focus().toggleBold().run()
      },
    ],
    [
      EDITOR_SHORTCUT_COMMAND_IDS.italic,
      () => {
        editor.chain().focus().toggleItalic().run()
      },
    ],
    [
      EDITOR_SHORTCUT_COMMAND_IDS.undo,
      () => {
        editor.chain().focus().undo().run()
      },
    ],
    [
      EDITOR_SHORTCUT_COMMAND_IDS.redo,
      () => {
        editor.chain().focus().redo().run()
      },
    ],
  ]
  const unregister = handlers.map(([id, handler]) => commandRegistry.registerHandler(id, handler))
  return () => unregister.reverse().forEach((remove) => remove())
}

/** Tiptap formatting keymaps are generated from the same commands shown in Settings. */
export const RegistryFormattingShortcuts = Extension.create({
  name: 'registryFormattingShortcuts',
  priority: 1000,

  addKeyboardShortcuts() {
    const shortcuts: Record<string, () => boolean> = {}

    for (const id of formattingShortcutIds) {
      const command = commandRegistry.get(id)
      if (!command?.shortcut) continue

      shortcuts[toTiptapShortcut(command.shortcut)] = () => {
        if (!commandRegistry.getAvailable().some((available) => available.id === id)) return false
        void command.execute()
        return true
      }
    }

    return shortcuts
  },
})
