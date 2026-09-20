import { describe, it, expect } from 'vitest'
import { commandRegistry, type Command } from './commandRegistry'
import {
  initialInspectorState,
  toggleInspectorSurface,
  openAssistantSurface,
  closeInspectorSurface,
} from '../types/inspectorState'

describe('CommandRegistry & InspectorState (P3.3, P3.5)', () => {
  it('registers and filters commands by context and search query', () => {
    const mockContext = {
      workspaceId: 'p1',
      workspaceRevision: 1,
      chapter: {
        id: 'ch-1',
        revision: 1,
        title: '第一章',
        content: '内容',
        wordCount: 2,
        semanticDocument: {} as any,
      },
      dirty: false,
    }

    const cmd: Command = {
      id: 'cmd-continuity-check',
      title: '检查本章连续性',
      keywords: ['continuity', 'audit', '连续性', '点检'],
      shortcut: 'Mod+Shift+C',
      category: 'continuity',
      availability: (ctx) => Boolean(ctx?.chapter),
      execute: () => {},
    }

    const unreg = commandRegistry.register(cmd)

    expect(commandRegistry.get('cmd-continuity-check')).toBeDefined()
    expect(commandRegistry.search('连续性', mockContext)).toHaveLength(1)
    expect(commandRegistry.search('non-existent', mockContext)).toHaveLength(0)
    expect(
      commandRegistry.findByShortcut(
        {
          key: 'c',
          ctrlKey: true,
          metaKey: false,
          shiftKey: true,
          altKey: false,
        },
        mockContext,
      ),
    ).toBe(cmd)

    unreg()
    expect(commandRegistry.get('cmd-continuity-check')).toBeUndefined()
  })

  it('handles inspector state transitions without boolean inversion glitches', () => {
    let state = initialInspectorState
    expect(state.surface).toBe('closed')

    state = openAssistantSurface()
    expect(state.surface).toBe('assistant')

    state = toggleInspectorSurface(state, 'assistant')
    expect(state.surface).toBe('closed')

    state = toggleInspectorSurface(state, 'references')
    expect(state.surface).toBe('references')

    state = closeInspectorSurface()
    expect(state.surface).toBe('closed')
  })
})
