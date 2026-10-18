/** Domain-specific review criteria for plugins that use the common AI review path. */
export const PLUGIN_REVIEW_RUBRICS: Record<string, readonly string[]> = {
  'multiverse-whatif': ['premise_inheritance', 'causal_dependencies', 'alternative_consequences'],
  'storyboard-gen': ['scene_evidence', 'visual_constraints', 'shot_options'],
  'brainstorm-spark': ['problem_constraints', 'option_prerequisites', 'consequence_options'],
  'archetype-cards': ['character_constraint', 'contrast_option', 'setup_check'],
  'chekhov-radar': ['unresolved_promise', 'payoff_evidence', 'next_action'],
  'clue-weaver': ['knowledge_boundary', 'discovery_order', 'clue_dependency'],
  'combat-sandbox': ['constraints', 'costs', 'causal_beats'],
  'consistency-sentinel': ['identity', 'state', 'power_constraint'],
  'dialogue-distiller': ['speaker_attribution', 'voice_consistency', 'revision'],
  'emotion-curve': ['annotated_sequence', 'transition', 'pacing_hypothesis'],
  'expectation-engine': ['promise_schedule', 'payoff', 'dependency'],
  'faction-matrix': ['relationship_evidence', 'state_change', 'possible_turn'],
  'multi-calendar': ['temporal_anchor', 'calendar_assumption', 'story_time_order'],
  'narrative-linter': ['clarity', 'attribution', 'revision'],
  'paywall-sentry': ['ending_feature', 'transition', 'audience_hypothesis'],
  'promise-ledger': ['promise_state', 'dependency', 'payoff_option'],
  'reader-hook': ['unresolved_question', 'stakes', 'ending_revision'],
  'reader-simulator': ['profile_interpretation', 'ambiguity', 'context_needed'],
  'safe-gate': ['literal_match', 'context', 'meaning_preserving_alternative'],
  'scene-beats': ['goal', 'conflict', 'consequence'],
  'shadow-reader': ['reader_knowledge', 'possible_interpretation', 'ambiguity'],
  'sub-plot-braid': ['thread_state', 'dormancy', 'convergence_dependency'],
  'subtext-compiler': ['speaker_goal', 'spoken_meaning', 'subtext_option'],
  'timeline-grid': ['causal_dependency', 'temporal_evidence', 'missing_prerequisite'],
  'volume-master': ['volume_goal', 'arc_constraints', 'transition'],
  'water-meter': ['literal_repetition', 'narrative_function', 'optional_cut'],
}

export interface PluginEvidenceSource {
  id: string
  label: string
  text: string
  start: number
  end: number
}

export interface GroundedPluginInput {
  schemaVersion: 'plugin-review-v2'
  input: Record<string, unknown>
  rubric: readonly string[]
  sources: PluginEvidenceSource[]
  coverage: Array<{
    label: string
    totalCharacters: number
    suppliedCharacters: number
    complete: boolean
  }>
  offsetUnit: string
  responseContract: Record<string, unknown>
}

/** Bounds each submitted field while retaining its real ending and disclosing omitted text. */
export function buildGroundedPluginInput(
  pluginId: string,
  input: unknown,
): GroundedPluginInput | null {
  const rubric = PLUGIN_REVIEW_RUBRICS[pluginId]
  if (!rubric) return null
  const values = isRecord(input) ? input : { text: input }
  const bounded: Record<string, unknown> = {}
  const sources: PluginEvidenceSource[] = []
  const coverage: GroundedPluginInput['coverage'] = []
  for (const [label, value] of Object.entries(values)) {
    if (value === undefined) continue
    const text = typeof value === 'string' ? value : JSON.stringify(value)
    if (text === undefined) continue
    const ranges =
      text.length <= 4000
        ? [[0, text.length]]
        : [
            [0, 3000],
            [text.length - 1000, text.length],
          ]
    const fieldSources = ranges
      .filter(([start, end]) => end > start)
      .map(([start, end], index) => ({
        id: `${label}:${index}`,
        label,
        start,
        end,
        text: text.slice(start, end),
      }))
    sources.push(...fieldSources)
    const suppliedCharacters = fieldSources.reduce((n, source) => n + source.text.length, 0)
    coverage.push({
      label,
      totalCharacters: text.length,
      suppliedCharacters,
      complete: suppliedCharacters === text.length,
    })
    bounded[label] =
      text.length <= 4000
        ? typeof value === 'string'
          ? value
          : JSON.parse(text)
        : {
            sourceIds: fieldSources.map((source) => source.id),
            totalCharacters: text.length,
            omittedMiddle: true,
          }
  }
  return {
    schemaVersion: 'plugin-review-v2',
    input: bounded,
    rubric,
    sources,
    coverage,
    offsetUnit: 'UTF-16 code units; quote offsets are relative to the named source excerpt',
    responseContract: {
      findings: [
        {
          aspect: 'one of the rubric values',
          observation: 'explicit content of the supplied evidence',
          interpretation: 'a contextual hypothesis, separated from the observation',
          recommendation: 'an optional proposal; use an empty string if no change is warranted',
          evidence: [
            { sourceId: 'an ID from sources', start: 0, end: 2, quote: 'exact source text' },
          ],
        },
      ],
      insufficientEvidence: ['missing context, constraints or data that prevent a conclusion'],
    },
  }
}

type ReviewValidation = { ok: true; text: string } | { ok: false; error: string }
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/** Validates source binding and shape, not the truth of a model's interpretation. */
export function validatePluginReview(raw: string, input: GroundedPluginInput): ReviewValidation {
  const invalid = (error: string): ReviewValidation => ({ ok: false, error })
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return invalid('分析没有返回约定的 JSON 结果')
  }
  if (
    !isRecord(parsed) ||
    !Array.isArray(parsed.findings) ||
    !Array.isArray(parsed.insufficientEvidence) ||
    !parsed.insufficientEvidence.every(isText)
  ) {
    return invalid('分析缺少发现列表或证据不足说明')
  }
  if (!parsed.findings.length && !parsed.insufficientEvidence.length)
    return invalid('没有发现或证据不足说明，不能视为检查通过')
  const lines = ['以下为模型分析；已核对引用，解释与建议仍需作者复核。']
  for (const field of input.coverage) {
    lines.push(
      `分析范围 ${field.label}：${field.suppliedCharacters} / ${field.totalCharacters} 个字符${field.complete ? '' : '，中间部分未提供'}。`,
    )
  }
  for (const finding of parsed.findings) {
    if (
      !isRecord(finding) ||
      !isText(finding.aspect) ||
      !input.rubric.includes(finding.aspect) ||
      !isText(finding.observation) ||
      !isText(finding.interpretation) ||
      typeof finding.recommendation !== 'string' ||
      !Array.isArray(finding.evidence) ||
      !finding.evidence.length
    ) {
      return invalid('发现缺少有效分类、观察、解释、建议或原文证据')
    }
    const citations: string[] = []
    for (const evidence of finding.evidence) {
      if (
        !isRecord(evidence) ||
        !isText(evidence.sourceId) ||
        !isText(evidence.quote) ||
        !Number.isInteger(evidence.start) ||
        !Number.isInteger(evidence.end)
      )
        return invalid('引用格式无效')
      const source = input.sources.find((s) => s.id === evidence.sourceId)
      const start = evidence.start as number
      const end = evidence.end as number
      if (
        !source ||
        start < 0 ||
        end <= start ||
        end > source.text.length ||
        source.text.slice(start, end) !== evidence.quote
      )
        return invalid('引用与所提交原文不一致，分析结果未展示')
      citations.push(
        `原文 ${source.label} [${source.start + start}, ${source.start + end})：「${evidence.quote}」`,
      )
    }
    lines.push(`观察：${finding.observation}`, ...citations, `模型解释：${finding.interpretation}`)
    if (finding.recommendation.trim()) lines.push(`修改建议：${finding.recommendation}`)
  }
  lines.push(...parsed.insufficientEvidence.map((reason) => `证据不足：${reason}`))
  return { ok: true, text: lines.join('\n') }
}
