/**
 * 评分来源词表（§P2.5）。
 *
 * 与组件分文件存放：react-fast-refresh 要求组件文件只导出组件，词表属于可复用数据。
 * 来源枚举固定为计划里的五种，插件不许自造第六种。
 */
export type ScoreProvenance = 'rule' | 'ai' | 'historical' | 'user' | 'inference'

const SCORE_PROVENANCE_LABELS: Record<ScoreProvenance, string> = {
  rule: '即时规则',
  ai: 'AI 分析',
  historical: '历史数据模型',
  user: '用户设定',
  inference: '推测',
}

export function scoreProvenanceLabel(source: ScoreProvenance): string {
  return SCORE_PROVENANCE_LABELS[source]
}
