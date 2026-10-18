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
  private buildErrors: SafeGateScanResult['ruleErrors'] = []

  public build(words: SensitiveWord[], regexRules: RegexRule[]): void {
    this.regexList = []
    this.buildErrors = []
    const validWords = words.filter((word) => {
      if (word.word.length > 0) return true
      this.buildErrors.push({ ruleId: word.id, message: '词项为空，未执行此规则。' })
      return false
    })
    this.acEngine.build(validWords.map((word) => ({ keyword: word.word, payload: word })))
    for (const rule of regexRules) {
      try {
        const flags = rule.flags.includes('g') ? rule.flags : `${rule.flags}g`
        this.regexList.push({ rule, regex: new RegExp(rule.pattern, flags) })
      } catch {
        this.buildErrors.push({ ruleId: rule.id, message: '正则表达式或标记无效，未执行此规则。' })
      }
    }
  }

  public scan(text: string, genre: GenreStyle = 'neutral'): SafeGateScanResult {
    const ruleErrors = [...this.buildErrors]
    const violations: SafeGateViolation[] = this.acEngine.scan(text).map((match) => ({
      id: `v-ac-${match.payload.id}-${match.startIndex}-${match.endIndex}`,
      ruleType: 'ac_exact',
      wordId: match.payload.id,
      matchedText: text.slice(match.startIndex, match.endIndex),
      startIndex: match.startIndex,
      endIndex: match.endIndex,
      level: match.payload.level,
      category: match.payload.category,
      suggestions: this.sortSuggestions(match.payload.literaryAlternatives, genre),
    }))
    for (const { rule, regex } of this.regexList) {
      regex.lastIndex = 0
      let hasEmptyMatch = false
      let match: RegExpExecArray | null
      while ((match = regex.exec(text)) !== null) {
        if (match[0].length === 0) {
          hasEmptyMatch = true
          const point = text.codePointAt(regex.lastIndex)
          regex.lastIndex += point !== undefined && point > 0xffff ? 2 : 1
          continue
        }
        violations.push({
          id: `v-reg-${rule.id}-${match.index}-${match.index + match[0].length}`,
          ruleType: 'regex',
          regexRuleId: rule.id,
          matchedText: match[0],
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          level: rule.level,
          category: rule.category,
          suggestions: this.sortSuggestions(rule.literaryAlternatives, genre),
        })
      }
      if (hasEmptyMatch)
        ruleErrors.push({ ruleId: rule.id, message: '规则产生空匹配；空匹配已忽略，请修改规则。' })
    }
    const unique = [...new Map(violations.map((item) => [item.id, item])).values()].sort(
      (a, b) => a.startIndex - b.startIndex || a.endIndex - b.endIndex,
    )
    const complete = ruleErrors.length === 0
    return {
      violations: unique,
      redCount: unique.filter((item) => item.level === 'red').length,
      yellowCount: unique.filter((item) => item.level === 'yellow').length,
      blueCount: unique.filter((item) => item.level === 'blue').length,
      isClean: complete && unique.length === 0,
      complete,
      ruleErrors,
      sourceText: text,
    }
  }

  private matchesSource(text: string, item: SafeGateViolation): boolean {
    return (
      Number.isSafeInteger(item.startIndex) &&
      Number.isSafeInteger(item.endIndex) &&
      item.startIndex >= 0 &&
      item.endIndex > item.startIndex &&
      item.endIndex <= text.length &&
      text.slice(item.startIndex, item.endIndex) === item.matchedText
    )
  }

  public applyReplacement(
    text: string,
    violation: SafeGateViolation,
    alternative: LiteraryAlternative,
  ): string {
    if (!this.matchesSource(text, violation)) return text
    return (
      text.slice(0, violation.startIndex) + alternative.replacement + text.slice(violation.endIndex)
    )
  }

  public applyAllAuto(
    text: string,
    result: SafeGateScanResult,
    genre: GenreStyle = 'neutral',
  ): string {
    if (!result.complete || result.sourceText !== text) return text
    const edits = result.violations
      .filter((item) => item.suggestions.length > 0)
      .sort((a, b) => a.startIndex - b.startIndex)
    if (
      edits.some(
        (item, index) =>
          !this.matchesSource(text, item) ||
          (index > 0 && item.startIndex < edits[index - 1].endIndex),
      )
    )
      return text
    return edits
      .reverse()
      .reduce(
        (modified, item) =>
          modified.slice(0, item.startIndex) +
          this.sortSuggestions(item.suggestions, genre)[0].replacement +
          modified.slice(item.endIndex),
        text,
      )
  }

  private sortSuggestions(
    suggestions: LiteraryAlternative[],
    genre: GenreStyle,
  ): LiteraryAlternative[] {
    const priority = (item: LiteraryAlternative) =>
      item.genre.includes(genre) ? 2 : item.genre.includes('neutral') ? 1 : 0
    return [...suggestions].sort((a, b) => priority(b) - priority(a))
  }
}

export const safeGateEngine = new SafeGateEngine()
