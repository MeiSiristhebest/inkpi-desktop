// 三级敏感词审查与文学平替 (safe-gate) 领域模型与类型定义

export type SensitivityLevel = 'red' | 'yellow' | 'blue'

export type GenreStyle =
  | 'xianxia' // 仙侠修真
  | 'urban' // 都市现代
  | 'historical' // 古代历史
  | 'sci_fi' // 科幻赛博
  | 'fantasy' // 西幻魔法
  | 'neutral' // 通用中性

export interface LiteraryAlternative {
  replacement: string
  genre: GenreStyle[]
  exampleContext?: string
  confidence: number // 0.0 ~ 1.0，推荐置信度
}

export interface SensitiveWord {
  id: string
  word: string
  level: SensitivityLevel
  category: string
  literaryAlternatives: LiteraryAlternative[]
}

export interface RegexRule {
  id: string
  pattern: string
  flags: string
  level: SensitivityLevel
  category: string
  literaryAlternatives: LiteraryAlternative[]
}

export interface SafeGateViolation {
  id: string
  ruleType: 'ac_exact' | 'regex'
  wordId?: string
  regexRuleId?: string
  matchedText: string
  startIndex: number
  endIndex: number
  level: SensitivityLevel
  category: string
  suggestions: LiteraryAlternative[]
}

export interface SafeGateScanResult {
  violations: SafeGateViolation[]
  redCount: number
  yellowCount: number
  blueCount: number
  isClean: boolean
}
