import { scoreProvenanceLabel, type ScoreProvenance } from './scoreProvenance'

/**
 * 评分型结果的来源徽章（§P2.5）。
 *
 * 这类插件给出的数字几乎全是当场跑出来的关键词/结构公式，但过去的 UI 把它们念成了对读者行为的
 * 预测（「首订巅峰」「付费转化潜力」「置信度 92%」）。INV-09 要求界面说的就是实际发生的：数字从哪
 * 来就必须写在数字旁边，由作者决定信多少。
 */
export interface ScoreProvenanceBadgeProps {
  source: ScoreProvenance
  /** 这一处评分的具体口径，例如「按章尾悬念词与断句密度计分」。缺省时只标来源。 */
  detail?: string
}

export const ScoreProvenanceBadge = ({ source, detail }: ScoreProvenanceBadgeProps) => (
  <span
    data-testid="score-provenance"
    className="inline-flex items-center gap-1 text-[11px] text-[var(--ink-text-faint)]"
  >
    <span className="px-1.5 py-0.5 rounded border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] font-medium">
      来源：{scoreProvenanceLabel(source)}
    </span>
    {detail && <span className="truncate">{detail}</span>}
  </span>
)
