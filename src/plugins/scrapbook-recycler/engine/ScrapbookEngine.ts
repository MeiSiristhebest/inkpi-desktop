import * as Diff from 'diff'
import type { ScrapbookFragmentRecord, ScrapRecommendation } from '../types'

export class ScrapbookEngine {
  static extractDeletedFragments(
    oldText: string,
    newText: string,
    sourceChapterId?: string,
    sourceChapterTitle?: string,
  ): Array<Omit<ScrapbookFragmentRecord, 'id' | 'projectId' | 'deletedAt'>> {
    const fragments: Array<Omit<ScrapbookFragmentRecord, 'id' | 'projectId' | 'deletedAt'>> = []
    let sourceOffset = 0
    for (const part of Diff.diffChars(oldText, newText)) {
      if (part.removed && part.value.trim())
        fragments.push({
          sourceChapterId,
          sourceChapterTitle,
          sourceOffset,
          snippet: part.value,
          wordCount: Array.from(part.value.replace(/\s/gu, '')).length,
          tags: [...new Set(this.tokenize(part.value))].slice(0, 4),
          isReused: false,
        })
      if (!part.added) sourceOffset += part.value.length
    }
    return fragments
  }

  static tokenize(text: string): string[] {
    const tokens: string[] = []
    for (const word of text.split(/[^\p{L}\p{N}]+/u).filter(Boolean)) {
      tokens.push(word)
      const characters = Array.from(word)
      if (characters.length > 2)
        for (let i = 0; i < characters.length - 1; i++)
          tokens.push(characters[i] + characters[i + 1])
    }
    return tokens
  }

  static recommendFragments(
    contextText: string,
    fragments: ScrapbookFragmentRecord[],
    topK = 5,
  ): ScrapRecommendation[] {
    if (!Number.isInteger(topK) || topK < 0) throw new Error('检索数量必须为非负整数。')
    if (topK === 0 || !contextText.trim()) return []
    const available = fragments.filter((f) => !f.isReused)
    const docs = available.map((f) => this.tokenize(f.snippet))
    const query = this.tokenize(contextText)
    if (!query.length) return []
    const frequency = new Map<string, number>()
    for (const doc of docs)
      for (const word of new Set(doc)) frequency.set(word, (frequency.get(word) ?? 0) + 1)
    const vector = (tokens: string[]) => {
      const result = new Map<string, number>()
      for (const word of tokens) result.set(word, (result.get(word) ?? 0) + 1)
      for (const [word, count] of result)
        result.set(
          word,
          count * (1 + Math.log((docs.length + 1) / ((frequency.get(word) ?? 0) + 1))),
        )
      return result
    }
    const queryVector = vector(query)
    const norm = (v: Map<string, number>) =>
      Math.sqrt([...v.values()].reduce((sum, x) => sum + x * x, 0))
    const qNorm = norm(queryVector)
    const results: ScrapRecommendation[] = []
    available.forEach((fragment, i) => {
      const docVector = vector(docs[i])
      const matchedKeywords = [...queryVector.keys()].filter((word) => docVector.has(word))
      const dot = matchedKeywords.reduce(
        (sum, word) => sum + queryVector.get(word)! * docVector.get(word)!,
        0,
      )
      const denominator = qNorm * norm(docVector)
      if (dot > 0 && denominator > 0)
        results.push({
          fragment,
          similarityScore: Math.min(1, dot / denominator),
          matchedKeywords,
          rankingMethod: 'literal-tfidf',
        })
    })
    return results
      .sort(
        (a, b) =>
          b.similarityScore - a.similarityScore || a.fragment.id.localeCompare(b.fragment.id),
      )
      .slice(0, topK)
  }
}
