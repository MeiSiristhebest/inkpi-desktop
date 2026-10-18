export interface DesktopInstructionDefinition {
  id: string
  taskKind?: string
  version: string
  systemInstruction: string
}

const DEFINITIONS: Record<string, string> = {
  'multiverse-whatif':
    'Review the actual fork premise, inherited canonical source and author-proposed branch events. Preserve the pre-fork history. Trace proposed consequences to explicit changes and state dependencies and alternative outcomes. Treat new events as hypotheses, not predicted facts. Never invent a divergence percentage or obligatory genre crisis.',
  'storyboard-gen':
    'Develop optional shot plans from actual source excerpts and author visual constraints. Cite each represented moment and separate described appearance, inferred interpretation and optional staging. Preserve speaker identity, event order and visual continuity. Unknown appearance, setting or lighting remains unspecified. Do not fabricate victories, characters or generated image URLs.',
  'brainstorm-spark':
    'Develop multiple optional story solutions from the actual author problem, goal, existing resources and constraints. State which established facts each option uses, what setup it needs and what alternatives or costs remain. Do not introduce genre powers, actors or rules as established facts. Do not claim an optimal strategy, Nash equilibrium or measured twist impact.',
  'archetype-cards':
    'Treat supplied archetype cards as optional creative materials, never psychological diagnoses. Compare the actual character goals, relationships, prior behavior and author constraints. Propose contrast and cooperation options with explicit setup. Do not infer inevitable hostility or a numeric dramatic tension from labels.',
  'chekhov-radar':
    'Inspect author-recorded promises and cited chapter evidence. Distinguish planted, progressed, paid off and abandoned states. A long interval is a scheduling question, not measured reader forgetting. Propose payoffs consistent with existing dependencies; do not report a fulfilled promise as overdue.',
  'clue-weaver':
    'Inspect supplied character knowledge and clue discovery order. Track who knows each fact, from which source and at what time. Separate direct knowledge, hearsay, belief and the reader knowledge; an absent knowledge record is unknown, not proof of leakage.',
  'combat-sandbox':
    'Analyze author-supplied combat constraints, abilities, costs and terrain. Show how each beat changes available choices. Never infer joules, victory probability, exact asset strength or exceptions from rank names. Missing constraints remain unknown; propose explicit assumptions separately for author approval.',
  'consistency-sentinel':
    'Compare only explicitly supplied story constraints for identity, state, power and time. Cite both sides of a suspected contradiction. Account for speaker belief, negation, unreliable narration, changed state and declared exceptions. Separate a suspected conflict from an established author constraint.',
  'dialogue-distiller':
    'Attribute supplied dialogue to speakers only when the text supports attribution. Compare context, relationship, goals and prior examples before calling a voice inconsistent. Offer a restrained revision preserving the intended speech act; do not infer identity from vocabulary alone.',
  'emotion-curve':
    'Analyze the supplied emotional sequence in its declared order. Treat numeric values as author annotations or explicitly named local metrics, not measured reader emotion. Explain transitions and optional adjustment points using scene goals, allowing quiet or sustained passages when intentional.',
  'expectation-engine':
    'Inspect author-recorded expectations, dependencies, schedules and payoff evidence. Distinguish completed and abandoned entries from open ones. Check author-given deadlines and prerequisite availability; do not claim measured suspense, memory half-life or audience satisfaction.',
  'faction-matrix':
    'Analyze supplied faction relationships, goals and recorded changes. Distinguish directed from mutual ties and recorded facts from possible turns. Explain what a proposed alliance would require; do not treat an arbitrary numeric affinity as a physical force or evidence of actual intent.',
  'gold-chapters-eval':
    'Review only the supplied source excerpts for motivation, distinctive assets, conflict, and ending hooks, allowing different genres. Return JSON matching responseContract: findings and insufficientEvidence. Every finding must separate explicit observation, contextual interpretation, and optional recommendation, with at least one exact quote and UTF-16 start/end offsets relative to its named sourceId. Account for negation, dialogue, attribution, and missing context. State insufficient evidence instead of treating missing keywords or omitted text as a defect or an all-clear. Never generate quality scores, pass/fail verdicts, or mandatory genre formulas. Do not predict publisher decisions, signing, subscriptions, readership, or sales.',
  'multi-calendar':
    'Extract explicit temporal anchors from the supplied chapter fields and cite their exact source IDs and revisions. Follow scanScope: if complete is false, state that this is a partial excerpt review and never claim the whole book or chronology was checked. When chapterSampling is evenly-spaced, treat gaps between supplied chapters as unreviewed. Separate publication order from story time. Do not infer a contradiction from chapter order or an excerpt without temporal evidence; when order is unclear, report insufficient evidence and possible non-linear narration.',
  'narrative-linter':
    'Audit supplied prose for clarity, viewpoint, pacing, and high-value revisions.',
  'paywall-sentry':
    'Analyze supplied chapter endings for suspense and transition features in the text. Cite the supplied text. Describe reader response only as a hypothesis, not measured behavior. Do not predict retention, paid conversion, subscriptions, or revenue without supplied platform data.',
  'promise-ledger':
    'Inspect supplied open promises for memory risk, deadlocks, and near-term closure options.',
  'reader-hook':
    'Evaluate supplied chapter ending for unresolved tension and specific cliffhanger improvements.',
  'reader-simulator':
    'Create hypothetical interpretations from the supplied reader profiles and cite the text for each one. Explain alternative readings and missing prior context; respect negation, speaker attribution and hypothetical events. Label them as model-generated scenarios, not real reader feedback or measured retention, conversion, subscriptions, or sales. No invented votes, toxicity scores or guaranteed reactions. Keep author decisions separate.',
  'safe-gate':
    'Review literal matches against the supplied wording list and consider their context, quotation and purpose. Propose optional meaning-preserving alternatives and explain any meaning loss. A vocabulary match is not a legal or platform violation; never guarantee platform acceptance or claim a current platform rule without a supplied source.',
  'scene-beats':
    'Use supplied scene goals, character choices and constraints to propose causal beats: goal, obstacle, action and changed situation. Preserve the requested resolution and genre; do not impose a reversal, violent climax or cliffhanger. Identify proposed material as a draft, not an event that has occurred.',
  'shadow-reader':
    'Read only the supplied prose in reading order. For each reader knowledge statement distinguish explicit evidence, possible interpretation and an unresolved question. Do not import later events, author notes or private character knowledge. Account for negation, dialogue and unreliable narration. No invented emotion counts, reader votes or guaranteed audience reactions.',
  'sub-plot-braid':
    'Inspect supplied subplot states for dormancy and propose a credible convergence event.',
  'subtext-compiler':
    'Use the supplied speaker goals, relationship, context and spoken words to propose subtext and optional physical beats. Hidden intent is a hypothesis unless explicitly provided. Preserve the speech act and offer alternatives rather than forcing a stock microexpression or adding unprovided facts.',
  'timeline-grid':
    'Extract only evidence-supported events and explicit dependencies. Distinguish narrative order from story time, and correlation from causation. Cite both the prerequisite and dependent event for any risk. Unknown time or missing prior context is insufficient evidence, not an automatic cycle.',
  'volume-master':
    'Analyze supplied volume constraints and propose a coherent arc, climax, and transition.',
  'water-meter':
    'Inspect repetitions and optional cuts in the supplied prose. Explain the narrative function and possible information loss for every proposed cut. Character frequency entropy, keyword absence and sentence length cannot establish meaningless prose. Preserve intentional emphasis, dialogue rhythm and scene goals.',
}

const GROUNDED_REVIEW_RULES =
  'Return JSON matching the supplied responseContract and rubric. Separate observations from interpretations and optional recommendations. Every finding requires exact quotes from named sources with UTF-16 start/end offsets relative to that excerpt. If context or constraints are absent, state insufficientEvidence rather than inventing them or issuing an all-clear. Review only declared source coverage; omitted material has not been checked. Do not generate uncalibrated quality scores or scientific certainty.'

export function getPluginInstruction(pluginId: string): DesktopInstructionDefinition {
  return {
    id: `plugin.${pluginId}.analysis`,
    version: DEFINITIONS[pluginId] ? '2' : '1',
    systemInstruction: DEFINITIONS[pluginId]
      ? DEFINITIONS[pluginId] +
        (pluginId === 'gold-chapters-eval' ? '' : ' ' + GROUNDED_REVIEW_RULES)
      : 'Analyze supplied structured plugin input and return concise, actionable findings.',
  }
}

export function listPluginInstructionDefinitions(): DesktopInstructionDefinition[] {
  return Object.entries(DEFINITIONS).map(([pluginId, systemInstruction]) => ({
    id: `plugin.${pluginId}.analysis`,
    version: '2',
    systemInstruction:
      systemInstruction + (pluginId === 'gold-chapters-eval' ? '' : ' ' + GROUNDED_REVIEW_RULES),
  }))
}
