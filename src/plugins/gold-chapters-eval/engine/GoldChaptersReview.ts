import { GoldChaptersEngine, OPENING_DIMENSIONS } from './GoldChaptersEngine'

type AnalysisInput = ReturnType<typeof GoldChaptersEngine.buildAnalysisInput>
type ReviewValidation = { ok: true; text: string } | { ok: false; error: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/** Checks citation binding and shape only. A valid citation does not prove an interpretation true. */
export function validateGoldReview(raw: string, input: AnalysisInput): ReviewValidation {
  const invalid = (error: string): ReviewValidation => ({ ok: false, error })
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return invalid('AI 点评未返回约定的 JSON 结果')
  }
  if (
    !isRecord(parsed) ||
    !Array.isArray(parsed.findings) ||
    !Array.isArray(parsed.insufficientEvidence) ||
    !parsed.insufficientEvidence.every(isText)
  ) {
    return invalid('AI 点评缺少发现列表或证据不足说明')
  }
  if (!parsed.findings.length && !parsed.insufficientEvidence.length) {
    return invalid('AI 点评没有提供发现或说明证据不足，不能视为检查通过')
  }
  const lines = [
    `分析范围：已提供 ${input.coverage.suppliedCharacters} / ${input.coverage.totalCharacters} 个字符；${input.coverage.complete ? '覆盖所提交文本' : '部分节选，未检查省略部分'}。`,
    '以下为模型建议；已核对引用位置，解释仍需作者复核。',
  ]
  for (const finding of parsed.findings) {
    if (
      !isRecord(finding) ||
      !isText(finding.dimension) ||
      !Object.hasOwn(OPENING_DIMENSIONS, finding.dimension) ||
      !isText(finding.observation) ||
      !isText(finding.interpretation) ||
      !isText(finding.recommendation) ||
      !Array.isArray(finding.evidence) ||
      !finding.evidence.length
    ) {
      return invalid('AI 点评的发现缺少有效维度、观察、解释、建议或原文证据')
    }
    const citations: string[] = []
    for (const evidence of finding.evidence) {
      if (
        !isRecord(evidence) ||
        !isText(evidence.sourceId) ||
        !isText(evidence.quote) ||
        !Number.isInteger(evidence.start) ||
        !Number.isInteger(evidence.end)
      ) {
        return invalid('AI 点评的原文引用格式无效')
      }
      const source = input.sources.find((candidate) => candidate.id === evidence.sourceId)
      const start = evidence.start as number
      const end = evidence.end as number
      if (
        !source ||
        start < 0 ||
        end <= start ||
        end > source.text.length ||
        source.text.slice(start, end) !== evidence.quote
      ) {
        return invalid('AI 点评的引用与所提交原文不一致，结果未展示')
      }
      citations.push(`原文 [${source.start + start}, ${source.start + end})：「${evidence.quote}」`)
    }
    lines.push(
      `观察：${finding.observation}`,
      ...citations,
      `模型解释：${finding.interpretation}`,
      `修改建议：${finding.recommendation}`,
    )
  }
  lines.push(...parsed.insufficientEvidence.map((reason) => `证据不足：${reason}`))
  return { ok: true, text: lines.join('\n') }
}
