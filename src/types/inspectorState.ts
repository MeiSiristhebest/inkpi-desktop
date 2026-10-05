export type InspectorSurface = 'closed' | 'assistant' | 'activity' | 'plugin'

export interface InspectorState {
  surface: InspectorSurface
  pluginId?: string
}

/**
 * Which panel the right-hand inspector shows. `'plugin'` is intentionally `'none'`: a capability
 * that wants its own view is served by the plugin drawer host inside the desk. Naming the mapping
 * keeps the union from advertising a surface the composition root has no renderer for, which is how
 * every AI action ended up opening the chat drawer.
 */
export type InspectorPanel = 'none' | 'chat' | 'activity'

export function inspectorPanelFor(state: InspectorState): InspectorPanel {
  switch (state.surface) {
    case 'assistant':
      return 'chat'
    case 'activity':
      return 'activity'
    case 'closed':
    case 'plugin':
      return 'none'
  }
}

/**
 * An `openInspector` request before it reaches any state: either the inspector can show it, or the
 * caller actually wants the plugin's own drawer. Keeping this decision out of the components is what
 * stops the composition root from inventing a renderer for a surface it does not have.
 */
export type InspectorRequest =
  | { kind: 'panel'; state: InspectorState }
  | { kind: 'drawer'; pluginId: string }
  | { kind: 'ignored' }

export function resolveInspectorRequest(
  surface: InspectorSurface,
  pluginId?: string,
): InspectorRequest {
  if (surface === 'plugin') {
    // A plugin request without an id asks for nothing in particular; opening the chat box instead
    // would be the exact bug this routing exists to prevent.
    return pluginId ? { kind: 'drawer', pluginId } : { kind: 'ignored' }
  }
  return { kind: 'panel', state: { surface, pluginId } }
}

export const initialInspectorState: InspectorState = {
  surface: 'closed',
}

export function openAssistantSurface(): InspectorState {
  return { surface: 'assistant' }
}

export function closeInspectorSurface(): InspectorState {
  return { surface: 'closed' }
}

export function toggleInspectorSurface(
  current: InspectorState,
  target: InspectorSurface,
  pluginId?: string,
): InspectorState {
  if (current.surface === target && (target !== 'plugin' || current.pluginId === pluginId)) {
    return { surface: 'closed' }
  }
  return { surface: target, pluginId }
}
