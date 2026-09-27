import type { PluginStaticDefinition } from './pluginDefinitions'
import { ALL_PLUGIN_DEFINITIONS } from './pluginDefinitions'
import { CAPABILITY_REGISTRY, type CapabilityDescriptor } from './capabilityRegistry'
import type { CapabilitySurface } from './capabilityRegistry'

/**
 * The hand-written registry described only ten of the forty-four plugins, while both the sidebar and
 * the command palette gate on it — so thirty-four plugins had no entry point even once enabled.
 * Everything that a plugin's own source can evidence is derived here instead of declared a second
 * time: a main view means the capability can be navigated to and owns the canvas, a drawer snippet
 * means it can be folded into the desk. Claims no source can evidence (`maturity`, the two mutation
 * flags) are deliberately left undeclared, because `maturity` renders as a stability badge.
 */
function derivePluginCapability(definition: PluginStaticDefinition): CapabilityDescriptor {
  const surfaces: CapabilitySurface[] = ['navigation', 'canvas']
  if (definition.drawer) surfaces.push('drawer')
  surfaces.push('command')
  return {
    id: definition.id,
    name: definition.name,
    category: definition.category,
    surfaces,
    description: definition.description,
  }
}

const derivedPlugins: Record<string, CapabilityDescriptor> = {}
for (const definition of ALL_PLUGIN_DEFINITIONS) {
  derivedPlugins[definition.id] = derivePluginCapability(definition)
}

/**
 * Curated entries win: their `surfaces` and `maturity` are hand-judged and some of them intentionally
 * omit `navigation`/`canvas`, which derivation would have added.
 */
export const ALL_CAPABILITIES: Record<string, CapabilityDescriptor> = {
  ...derivedPlugins,
  ...CAPABILITY_REGISTRY,
}

export function capabilityFor(id: string): CapabilityDescriptor | undefined {
  return ALL_CAPABILITIES[id]
}
