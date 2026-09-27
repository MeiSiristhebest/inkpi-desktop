import type { PluginStaticDefinition } from './pluginDefinitions'
import { ALL_PLUGIN_DEFINITIONS } from './pluginDefinitions'
import { TAB_DEFINITIONS } from '../config/tabDefinitions'
import { CAPABILITY_REGISTRY, type CapabilityOverlay } from './capabilityRegistry'
import type { CapabilityDescriptor } from './capabilityRegistry'
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
 * §P2.14: what a capability is called belongs to the catalog that registers it, not to this file.
 *
 * The registry used to repeat `id` and `name` for all forty-four entries and the copies had drifted —
 * the palette offered 「打开 世界设定集 (Living Codex)」 for the capability the sidebar lists as
 * 活体世界观. An id that matches neither catalog can no longer be named here, which is the point.
 */
const curated: Record<string, CapabilityDescriptor> = {}
const overlays: Record<string, CapabilityOverlay> = CAPABILITY_REGISTRY
for (const [id, overlay] of Object.entries(overlays)) {
  const plugin = ALL_PLUGIN_DEFINITIONS.find((definition) => definition.id === id)
  const tab = plugin ? undefined : TAB_DEFINITIONS.find((definition) => definition.id === id)
  curated[id] = {
    id,
    name: plugin?.name ?? tab?.name ?? id,
    category: overlay.category,
    maturity: overlay.maturity,
    surfaces: overlay.surfaces,
    mutatesDocument: overlay.mutatesDocument,
    mutatesCanonicalState: overlay.mutatesCanonicalState,
    // 模块的说明留在注册表里：目录里那段是表单前言，不是面板文案。插件的说明由插件定义自己说。
    description: overlay.description ?? plugin?.description ?? tab?.description ?? '',
  }
}

export const ALL_CAPABILITIES: Record<string, CapabilityDescriptor> = {
  ...derivedPlugins,
  ...curated,
}

export function capabilityFor(id: string): CapabilityDescriptor | undefined {
  return ALL_CAPABILITIES[id]
}
