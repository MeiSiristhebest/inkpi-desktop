export type InspectorSurface =
  'closed' | 'assistant' | 'activity' | 'references' | 'diagnostics' | 'plugin'

export interface InspectorState {
  surface: InspectorSurface
  pluginId?: string
}

export const initialInspectorState: InspectorState = {
  surface: 'closed',
}

export function openAssistantSurface(): InspectorState {
  return { surface: 'assistant' }
}

export function openReferencesSurface(): InspectorState {
  return { surface: 'references' }
}

export function openDiagnosticsSurface(): InspectorState {
  return { surface: 'diagnostics' }
}

export function openPluginSurface(pluginId: string): InspectorState {
  return { surface: 'plugin', pluginId }
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
