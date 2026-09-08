export interface DesktopInstructionDefinition {
  id: string
  taskKind?: string
  version: string
  systemInstruction: string
}

const DEFINITIONS: Record<string, string> = {
  'chekhov-radar': 'Inspect supplied chapter samples for unresolved narrative promises and propose concrete payoff points.',
  'clue-weaver': 'Inspect supplied information states for viewpoint leakage and unsafe knowledge transitions.',
  'combat-sandbox': 'Analyze supplied combat constraints and produce a consistent sequence with explicit costs.',
  'consistency-sentinel': 'Audit supplied story constraints for power, identity, and state contradictions.',
  'dialogue-distiller': 'Compare supplied dialogue samples for character voice consistency and actionable revisions.',
  'emotion-curve': 'Analyze supplied emotional sequence for pacing problems and concrete adjustment points.',
  'expectation-engine': 'Inspect supplied promise schedule for delayed or over-concentrated payoffs.',
  'faction-matrix': 'Analyze supplied faction relationships and identify plausible escalation or alliance turns.',
  'gold-chapters-eval': 'Evaluate supplied opening chapters for motivation, conflict, hook strength, and revision priorities.',
  'multi-calendar': 'Extract and check supplied temporal anchors for ordering, season, and age contradictions.',
  'narrative-linter': 'Audit supplied prose for clarity, viewpoint, pacing, and high-value revisions.',
  'paywall-sentry': 'Rank supplied chapter endings by reader retention potential and identify weak transition points.',
  'promise-ledger': 'Inspect supplied open promises for memory risk, deadlocks, and near-term closure options.',
  'reader-hook': 'Evaluate supplied chapter ending for unresolved tension and specific cliffhanger improvements.',
  'reader-simulator': 'Simulate contrasting reader reactions to supplied chapter and identify likely drop-off causes.',
  'safe-gate': 'Review supplied prose for platform-risk wording and suggest safe, meaning-preserving alternatives.',
  'scene-beats': 'Turn supplied scene constraints into four causal beats with clear escalation and a hook.',
  'sub-plot-braid': 'Inspect supplied subplot states for dormancy and propose a credible convergence event.',
  'subtext-compiler': 'Analyze supplied dialogue inputs for subtext, physical beats, and restrained rewrites.',
  'timeline-grid': 'Extract causal events from supplied chapter samples and flag ordering or dependency risks.',
  'volume-master': 'Analyze supplied volume constraints and propose a coherent arc, climax, and transition.',
  'water-meter': 'Audit supplied prose for low narrative momentum and identify concise, high-value cuts.',
}

export function getPluginInstruction(pluginId: string): DesktopInstructionDefinition {
  return {
    id: `plugin.${pluginId}.analysis`,
    version: '1',
    systemInstruction:
      DEFINITIONS[pluginId] ?? 'Analyze supplied structured plugin input and return concise, actionable findings.',
  }
}

export function listPluginInstructionDefinitions(): DesktopInstructionDefinition[] {
  return Object.entries(DEFINITIONS).map(([pluginId, systemInstruction]) => ({
    id: `plugin.${pluginId}.analysis`,
    version: '1',
    systemInstruction,
  }))
}
