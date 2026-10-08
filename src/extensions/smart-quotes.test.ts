import { describe, it, expect } from 'vitest'
import { Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { SmartQuotes } from './smart-quotes'

describe('SmartQuotes extension', () => {
  it('instantiates and provides input rules for Chinese typography', () => {
    const editor = new Editor({
      extensions: [StarterKit, SmartQuotes],
      content: '<p>测试</p>',
    })
    expect(editor).toBeDefined()
    expect(editor.extensionManager.extensions.some((e) => e.name === 'smartQuotes')).toBe(true)
    editor.destroy()
  })
})
