// 三级敏感词审查与文学平替核心算法引擎
// AC 自动机极速匹配 + 正则模式分层 + 逆序无损批量平替

import type {
  SensitiveWord,
  RegexRule,
  SafeGateViolation,
  SafeGateScanResult,
  GenreStyle,
  LiteraryAlternative,
} from '../types'
import { GenericAhoCorasick } from '../../../utils/AhoCorasick'

export class SafeGateEngine {
  private acEngine = new GenericAhoCorasick<SensitiveWord>()
  private regexList: { rule: RegexRule; regex: RegExp }[] = []
  private wordMap = new Map<string, SensitiveWord>()

  /**
   * 初始化引擎：构建 AC 自动机树与编译正则
   */
  public build(words: SensitiveWord[], regexRules: RegexRule[]): void {
    this.wordMap.clear()
    this.regexList = []

    const items = words.map((w) => {
      this.wordMap.set(w.id, w)
      return {
        keyword: w.word,
        payload: w,
      }
    })
    this.acEngine.build(items)

    // 预编译正则表达式
    for (const rule of regexRules) {
      try {
        const flags = rule.flags.includes('g') ? rule.flags : `${rule.flags}g`
        this.regexList.push({
          rule,
          regex: new RegExp(rule.pattern, flags),
        })
      } catch (e) {
        console.warn(`Invalid regex pattern in safe-gate rule ${rule.id}:`, e)
      }
    }
  }

  /**
   * 对正文执行分层扫描
   */
  public scan(text: string, genre: GenreStyle = 'xianxia'): SafeGateScanResult {
    if (!text || text.length === 0) {
      return { violations: [], redCount: 0, yellowCount: 0, blueCount: 0, isClean: true }
    }

    const violations: SafeGateViolation[] = []

    // 阶段 1：通用 AC 自动机精确扫描
    const matches = this.acEngine.scan(text)
    for (const match of matches) {
      const word = match.payload
      violations.push({
        id: `v-ac-${match.startIndex}-${match.endIndex}`,
        ruleType: 'ac_exact',
        wordId: word.id,
        matchedText: word.word,
        startIndex: match.startIndex,
        endIndex: match.endIndex,
        level: word.level,
        category: word.category,
        suggestions: this.sortSuggestions(word.literaryAlternatives, genre),
      })
    }

    // 阶段 2：正则表达式模糊规则扫描
    for (const { rule, regex } of this.regexList) {
      regex.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = regex.exec(text)) !== null) {
        const startIndex = match.index
        const endIndex = startIndex + match[0].length
        violations.push({
          id: `v-reg-${startIndex}-${endIndex}`,
          ruleType: 'regex',
          regexRuleId: rule.id,
          matchedText: match[0],
          startIndex,
          endIndex,
          level: rule.level,
          category: rule.category,
          suggestions: this.sortSuggestions(rule.literaryAlternatives, genre),
        })
      }
    }

    // 阶段 3：区间去重与排序（按 startIndex 升序）
    const deduplicated = this.deduplicateViolations(violations)

    let redCount = 0
    let yellowCount = 0
    let blueCount = 0

    for (const v of deduplicated) {
      if (v.level === 'red') redCount++
      else if (v.level === 'yellow') yellowCount++
      else if (v.level === 'blue') blueCount++
    }

    return {
      violations: deduplicated,
      redCount,
      yellowCount,
      blueCount,
      isClean: deduplicated.length === 0,
    }
  }

  /**
   * 单项精准替换
   */
  public applyReplacement(
    text: string,
    violation: SafeGateViolation,
    chosenAlternative: LiteraryAlternative,
  ): string {
    if (violation.startIndex < 0 || violation.endIndex > text.length) return text
    return (
      text.slice(0, violation.startIndex) +
      chosenAlternative.replacement +
      text.slice(violation.endIndex)
    )
  }

  /**
   * 批量一键平替（数学关键：从后向前逆序替换）
   * 逆序操作可确保前方的 startIndex / endIndex 绝对偏移量不发生漂移！
   */
  public applyAllAuto(
    text: string,
    result: SafeGateScanResult,
    genre: GenreStyle = 'xianxia',
  ): string {
    if (!result.violations || result.violations.length === 0) return text

    // 按 startIndex 从大到小降序排列
    const sorted = [...result.violations].sort((a, b) => b.startIndex - a.startIndex)

    let modified = text
    for (const v of sorted) {
      if (!v.suggestions || v.suggestions.length === 0) continue
      const sortedSuggestions = this.sortSuggestions(v.suggestions, genre)
      const best = sortedSuggestions[0]
      if (!best) continue
      modified = modified.slice(0, v.startIndex) + best.replacement + modified.slice(v.endIndex)
    }

    return modified
  }

  /**
   * 根据当前作品文风，将最贴合的平替词排在最前
   */
  private sortSuggestions(
    suggestions: LiteraryAlternative[],
    genre: GenreStyle,
  ): LiteraryAlternative[] {
    return [...suggestions].sort((a, b) => {
      const aMatches = a.genre.includes(genre) || a.genre.includes('neutral')
      const bMatches = b.genre.includes(genre) || b.genre.includes('neutral')
      if (aMatches && !bMatches) return -1
      if (!aMatches && bMatches) return 1
      return b.confidence - a.confidence
    })
  }

  /**
   * 移除重叠命中，优先保留高危害等级 (red > yellow > blue) 或更长区间
   */
  private deduplicateViolations(violations: SafeGateViolation[]): SafeGateViolation[] {
    if (violations.length <= 1) return violations

    // 优先级权重：red: 3, yellow: 2, blue: 1
    const levelWeight = { red: 3, yellow: 2, blue: 1 }

    // 先按 startIndex 升序，同起点按权重降序、长度降序
    const sorted = [...violations].sort((a, b) => {
      if (a.startIndex !== b.startIndex) return a.startIndex - b.startIndex
      const wDiff = levelWeight[b.level] - levelWeight[a.level]
      if (wDiff !== 0) return wDiff
      return b.endIndex - b.startIndex - (a.endIndex - a.startIndex)
    })

    const results: SafeGateViolation[] = []
    let lastEnd = -1

    for (const v of sorted) {
      if (v.startIndex >= lastEnd) {
        results.push(v)
        lastEnd = v.endIndex
      } else {
        // 重叠场景：如果当前项级别严格高于已入选的上一项，替换上一项
        const prev = results[results.length - 1]
        if (prev && levelWeight[v.level] > levelWeight[prev.level]) {
          results[results.length - 1] = v
          lastEnd = Math.max(prev.endIndex, v.endIndex)
        }
      }
    }

    return results
  }
}

export const safeGateEngine = new SafeGateEngine()
