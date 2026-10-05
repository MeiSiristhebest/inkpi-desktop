import { describe, expect, it } from 'vitest'
import {
  closeInspectorSurface,
  initialInspectorState,
  inspectorPanelFor,
  openAssistantSurface,
  resolveInspectorRequest,
  toggleInspectorSurface,
  type InspectorSurface,
} from './inspectorState'

const ALL_SURFACES: InspectorSurface[] = ['closed', 'assistant', 'activity', 'plugin']

describe('inspector surface routing', () => {
  it('maps every surface of the union to exactly one panel', () => {
    // The composition root used to test `surface !== 'closed'` and then render the chat drawer, so
    // every surface without a renderer of its own showed up as an AI chat box. Enumerating the
    // union here means a new member has to declare its panel before it can render anything.
    expect(ALL_SURFACES.map((surface) => inspectorPanelFor({ surface }))).toEqual([
      'none',
      'chat',
      'activity',
      'none',
    ])
  })

  it('keeps the right panel closed for surfaces the inspector cannot render', () => {
    // Engine derives `isRightPanelOpen` from the same mapping, so an empty right-hand shell cannot
    // come back either.
    for (const surface of ['closed', 'plugin'] as const) {
      expect(inspectorPanelFor({ surface, pluginId: 'pov-guard' })).toBe('none')
    }
  })

  it('routes a plugin request to the drawer host instead of into inspector state', () => {
    expect(resolveInspectorRequest('plugin', 'consistency-sentinel')).toEqual({
      kind: 'drawer',
      pluginId: 'consistency-sentinel',
    })
  })

  it('drops a plugin request with no plugin rather than falling back to chat', () => {
    expect(resolveInspectorRequest('plugin')).toEqual({ kind: 'ignored' })
    expect(resolveInspectorRequest('plugin', '').kind).toBe('ignored')
  })

  it('passes assistant, activity and closed requests through as panel state', () => {
    expect(resolveInspectorRequest('assistant')).toEqual({
      kind: 'panel',
      state: { surface: 'assistant', pluginId: undefined },
    })
    expect(resolveInspectorRequest('activity')).toEqual({
      kind: 'panel',
      state: { surface: 'activity', pluginId: undefined },
    })
    expect(resolveInspectorRequest('closed')).toEqual({
      kind: 'panel',
      state: { surface: 'closed', pluginId: undefined },
    })
  })

  it('toggles a surface closed only when it is the one already showing', () => {
    let state = initialInspectorState
    expect(state.surface).toBe('closed')

    state = openAssistantSurface()
    expect(inspectorPanelFor(state)).toBe('chat')

    state = toggleInspectorSurface(state, 'assistant')
    expect(state.surface).toBe('closed')

    state = toggleInspectorSurface(state, 'plugin', 'pov-guard')
    expect(state.surface).toBe('plugin')
    expect(toggleInspectorSurface(state, 'plugin', 'geo-map').surface).toBe('plugin')
    expect(toggleInspectorSurface(state, 'plugin', 'pov-guard').surface).toBe('closed')

    expect(closeInspectorSurface().surface).toBe('closed')
  })
})
