/** All first-party plugin IDs exposed by the desktop creative product. */
export const FIRST_PARTY_PLUGIN_IDS = [
  'aftermath-sync', 'archetype-cards', 'author-ops', 'brainstorm-spark',
  'chekhov-radar', 'clue-weaver', 'combat-sandbox', 'consistency-sentinel',
  'describe-palette', 'dialogue-distiller', 'diff-reviewer', 'emotion-curve',
  'expectation-engine', 'faction-matrix', 'geography-map', 'gold-chapters-eval',
  'iron-chamber', 'living-codex', 'memory-palace', 'multi-calendar',
  'multiverse-whatif', 'name-forge', 'narrative-linter', 'paywall-sentry',
  'pov-guard', 'press-forge', 'promise-ledger', 'reader-hook', 'reader-simulator',
  'rhythm-metronome', 'rhythm-radar', 'safe-gate', 'scene-beats',
  'scrapbook-recycler', 'shadow-reader', 'soundscape', 'sprint-arena',
  'storyboard-gen', 'sub-plot-braid', 'subtext-compiler', 'timeline-grid',
  'voice-preview', 'volume-master', 'water-meter',
] as const

export type FirstPartyPluginId = (typeof FIRST_PARTY_PLUGIN_IDS)[number]

export function isFirstPartyPluginId(pluginId: string): pluginId is FirstPartyPluginId {
  return (FIRST_PARTY_PLUGIN_IDS as readonly string[]).includes(pluginId)
}

export function assertFirstPartyPluginCatalog(ids: readonly string[]): void {
  const expected = new Set(FIRST_PARTY_PLUGIN_IDS)
  const actual = new Set(ids)
  if (expected.size !== actual.size || [...expected].some((id) => !actual.has(id))) {
    throw new Error('Desktop plugin catalog is out of sync with the first-party plugin registry')
  }
}
