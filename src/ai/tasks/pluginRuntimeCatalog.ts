import { isFirstPartyPluginId, type FirstPartyPluginId } from './pluginCatalog'

/** Phase 20 runtime boundary classes. */
export type PluginRuntimeClass =
  | 'pure-local'
  | 'shared-ai' // Uses the shared assistant task contract, not a plugin-specific task kind.
  | 'ai-task'
  | 'context-provider'
  | 'tool'
  | 'workflow'
  | 'ui-only'
  | 'hybrid'

export type PluginRuntimeTarget =
  | 'desktop-local-engine'
  | 'creative-task'
  | 'story-context-compiler'
  | 'extension-tool'
  | 'runtime-workflow'
  | 'desktop-ui'
  | 'creative-task-and-story-context'

export interface PluginRuntimeCatalogEntry {
  readonly pluginId: FirstPartyPluginId
  readonly runtimeClass: PluginRuntimeClass
  readonly runtimeTarget: PluginRuntimeTarget
  readonly taskKind?: string
  readonly analysisTaskKind?: string
  readonly toolName?: string
  readonly contextProviderId?: string
}

/**
 * The catalog is deliberately explicit. A new first-party plugin must choose
 * a Runtime boundary before it can be added to the product registry.
 */
export const PLUGIN_RUNTIME_CATALOG: Record<FirstPartyPluginId, PluginRuntimeCatalogEntry> = {
  'aftermath-sync': {
    pluginId: 'aftermath-sync',
    runtimeClass: 'pure-local',
    runtimeTarget: 'desktop-local-engine',
  },
  'archetype-cards': taskEntry('archetype-cards'),
  'author-ops': {
    pluginId: 'author-ops',
    runtimeClass: 'pure-local',
    runtimeTarget: 'desktop-local-engine',
  },
  'brainstorm-spark': taskEntry('brainstorm-spark'),
  'chekhov-radar': taskEntry('chekhov-radar'),
  'clue-weaver': taskEntry('clue-weaver'),
  'combat-sandbox': taskEntry('combat-sandbox'),
  'consistency-sentinel': {
    pluginId: 'consistency-sentinel',
    runtimeClass: 'hybrid',
    runtimeTarget: 'creative-task-and-story-context',
    taskKind: 'plugin.consistency-sentinel.analysis',
    contextProviderId: 'story.context.consistency-sentinel',
  },
  'describe-palette': {
    pluginId: 'describe-palette',
    runtimeClass: 'pure-local',
    runtimeTarget: 'desktop-local-engine',
  },
  'dialogue-distiller': taskEntry('dialogue-distiller'),
  'diff-reviewer': {
    pluginId: 'diff-reviewer',
    runtimeClass: 'tool',
    runtimeTarget: 'extension-tool',
    toolName: 'plugin.diff-reviewer.compute',
  },
  'emotion-curve': taskEntry('emotion-curve'),
  'expectation-engine': taskEntry('expectation-engine'),
  'faction-matrix': taskEntry('faction-matrix'),
  'geography-map': {
    pluginId: 'geography-map',
    runtimeClass: 'pure-local',
    runtimeTarget: 'desktop-local-engine',
  },
  'gold-chapters-eval': taskEntry('gold-chapters-eval'),
  'iron-chamber': {
    pluginId: 'iron-chamber',
    runtimeClass: 'pure-local',
    runtimeTarget: 'desktop-local-engine',
  },
  'living-codex': {
    pluginId: 'living-codex',
    runtimeClass: 'context-provider',
    runtimeTarget: 'story-context-compiler',
    contextProviderId: 'story.context.living-codex',
  },
  'manuscript-import': {
    pluginId: 'manuscript-import',
    runtimeClass: 'pure-local',
    runtimeTarget: 'desktop-local-engine',
  },
  'memory-palace': {
    pluginId: 'memory-palace',
    runtimeClass: 'tool',
    runtimeTarget: 'extension-tool',
    toolName: 'plugin.memory-palace.search',
  },
  'multi-calendar': taskEntry('multi-calendar'),
  'multiverse-whatif': {
    pluginId: 'multiverse-whatif',
    runtimeClass: 'workflow',
    runtimeTarget: 'runtime-workflow',
    taskKind: 'plugin.multiverse-whatif.workflow',
    analysisTaskKind: 'plugin.multiverse-whatif.analysis',
  },
  'name-forge': {
    pluginId: 'name-forge',
    runtimeClass: 'pure-local',
    runtimeTarget: 'desktop-local-engine',
  },
  'narrative-linter': taskEntry('narrative-linter'),
  'paywall-sentry': taskEntry('paywall-sentry'),
  'pov-guard': {
    pluginId: 'pov-guard',
    runtimeClass: 'pure-local',
    runtimeTarget: 'desktop-local-engine',
  },
  'press-forge': {
    pluginId: 'press-forge',
    runtimeClass: 'tool',
    runtimeTarget: 'extension-tool',
    toolName: 'plugin.press-forge.format',
  },
  'project-compass': {
    pluginId: 'project-compass',
    runtimeClass: 'ui-only',
    runtimeTarget: 'desktop-ui',
  },
  'promise-ledger': taskEntry('promise-ledger'),
  'reader-hook': taskEntry('reader-hook'),
  'reader-simulator': taskEntry('reader-simulator'),
  'reference-library': {
    pluginId: 'reference-library',
    runtimeClass: 'ui-only',
    runtimeTarget: 'desktop-ui',
  },
  'rhythm-metronome': {
    pluginId: 'rhythm-metronome',
    runtimeClass: 'pure-local',
    runtimeTarget: 'desktop-local-engine',
  },
  'rhythm-radar': {
    pluginId: 'rhythm-radar',
    runtimeClass: 'pure-local',
    runtimeTarget: 'desktop-local-engine',
  },
  'roleplay-sandbox': {
    pluginId: 'roleplay-sandbox',
    runtimeClass: 'shared-ai',
    runtimeTarget: 'creative-task',
  },
  'safe-gate': taskEntry('safe-gate'),
  'scene-beats': taskEntry('scene-beats'),
  'scrapbook-recycler': {
    pluginId: 'scrapbook-recycler',
    runtimeClass: 'tool',
    runtimeTarget: 'extension-tool',
    toolName: 'plugin.scrapbook-recycler.recommend',
  },
  'shadow-reader': taskEntry('shadow-reader'),
  soundscape: { pluginId: 'soundscape', runtimeClass: 'ui-only', runtimeTarget: 'desktop-ui' },
  'sprint-arena': {
    pluginId: 'sprint-arena',
    runtimeClass: 'ui-only',
    runtimeTarget: 'desktop-ui',
  },
  'storyboard-gen': {
    pluginId: 'storyboard-gen',
    runtimeClass: 'workflow',
    runtimeTarget: 'runtime-workflow',
    taskKind: 'plugin.storyboard-gen.workflow',
    analysisTaskKind: 'plugin.storyboard-gen.analysis',
  },
  'sub-plot-braid': taskEntry('sub-plot-braid'),
  'subtext-compiler': taskEntry('subtext-compiler'),
  'timeline-grid': taskEntry('timeline-grid'),
  'voice-preview': {
    pluginId: 'voice-preview',
    runtimeClass: 'ui-only',
    runtimeTarget: 'desktop-ui',
  },
  'volume-master': taskEntry('volume-master'),
  'water-meter': taskEntry('water-meter'),
  'world-pack-library': {
    pluginId: 'world-pack-library',
    runtimeClass: 'pure-local',
    runtimeTarget: 'desktop-local-engine',
  },
}

export function getPluginRuntimeEntry(pluginId: string): PluginRuntimeCatalogEntry | undefined {
  return isFirstPartyPluginId(pluginId) ? PLUGIN_RUNTIME_CATALOG[pluginId] : undefined
}

function taskEntry(pluginId: FirstPartyPluginId): PluginRuntimeCatalogEntry {
  return {
    pluginId,
    runtimeClass: 'ai-task',
    runtimeTarget: 'creative-task',
    taskKind: `plugin.${pluginId}.analysis`,
  }
}
