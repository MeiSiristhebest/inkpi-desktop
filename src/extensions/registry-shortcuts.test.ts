// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/react'
import { commandRegistry, EDITOR_SHORTCUT_COMMAND_IDS } from '../core/commandRegistry'
import {
  RegistryFormattingShortcuts,
  RegistryStarterKit,
  registerFormattingShortcutHandlers,
} from './registry-shortcuts'

describe('Tiptap shortcut integration', () => {
  let editor: Editor | null = null
  let host: HTMLDivElement | null = null
  let unregisterFormattingHandlers: (() => void) | undefined
  let unregisterOverride: (() => void) | undefined
  let originalCommand: ReturnType<typeof commandRegistry.get> | undefined

  afterEach(() => {
    if (editor && !editor.isDestroyed) editor.destroy()
    editor = null
    host?.remove()
    host = null
    unregisterFormattingHandlers?.()
    unregisterFormattingHandlers = undefined
    unregisterOverride?.()
    unregisterOverride = undefined
    if (originalCommand) commandRegistry.register(originalCommand)
    originalCommand = undefined
  })

  it('uses the registered formatting chord and disables StarterKit default chord', () => {
    const commandId = EDITOR_SHORTCUT_COMMAND_IDS.bold
    const command = commandRegistry.get(commandId)
    expect(command?.shortcut).toBe('Mod+B')
    if (!command) throw new Error('Bold command is missing from CommandRegistry')

    originalCommand = command
    unregisterOverride = commandRegistry.register({ ...command, shortcut: 'Mod+Shift+B' })
    host = document.createElement('div')
    document.body.append(host)
    editor = new Editor({
      element: host,
      extensions: [RegistryStarterKit, RegistryFormattingShortcuts],
      content: '<p>text</p>',
    })
    unregisterFormattingHandlers = registerFormattingShortcutHandlers(editor)
    editor.commands.setTextSelection({ from: 1, to: 3 })

    const oldChord = new KeyboardEvent('keydown', {
      key: 'b',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
    editor.view.dom.dispatchEvent(oldChord)
    expect(editor.isActive('bold')).toBe(false)

    const registeredChord = new KeyboardEvent('keydown', {
      key: 'b',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    })
    editor.view.dom.dispatchEvent(registeredChord)
    expect(editor.isActive('bold')).toBe(true)
  })
})
