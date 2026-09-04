import * as Diff from "diff"
import type { ScrapbookFragmentRecord, ScrapRecommendation } from "../types"

/**
 * ScrapbookEngine (废稿灵感碎纸机回收站引擎)
 *
 * 理论基础：
 * 1. 差异删除捕获：监控文本流变更，当且仅当删除文本块长度 >= 15 字时，自动萃取为灵感切片
 * 2. TF-IDF + Cosine 余弦相似度：离线计算光标上下文与废稿片段的语义共鸣度，支持“一键还魂”
 */
export class ScrapbookEngine {
  /**
   * 从旧文本与新文本的差异中萃取被删除的废稿片段 (字数 >= 15)
   */
  public static extractDeletedFragments(
    oldText: string,
    newText: string,
    sourceChapterId?: string,
    sourceChapterTitle?: string
  ): Array<Omit<ScrapbookFragmentRecord, "id" | "projectId" | "deletedAt">> {
    if (!oldText || oldText === newText) return []

    const diffs = Diff.diffChars(oldText, newText)
    const fragments: Array<Omit<ScrapbookFragmentRecord, "id" | "projectId" | "deletedAt">> = []

    for (const part of diffs) {
      if (part.removed) {
        const trimmed = part.value.trim()
        if (trimmed.length >= 15) {
          // 抽取前 3 个主要词作为 tag
          const words = this.tokenize(trimmed)
          const tags = words.slice(0, 4)

          fragments.push({
            sourceChapterId,
            sourceChapterTitle,
            snippet: trimmed,
            wordCount: trimmed.length,
            tags,
            isReused: false,
          })
        }
      }
    }

    return fragments
  }

  /**
   * 纯前端分词切分 (简易中文 2-Gram 与标点停用词过滤)
   */
  public static tokenize(text: string): string[] {
    const cleaned = text.replace(/[，。！？；、“”’（）《》\s\r\n]/g, " ")
    const rawTokens = cleaned.split(" ").filter((t) => t.length >= 2)
    const grams: string[] = []

    // 提取连续双字与原始词
    rawTokens.forEach((tok) => {
      grams.push(tok)
      if (tok.length >= 4) {
        for (let i = 0; i < tok.length - 1; i++) {
          grams.push(tok.slice(i, i + 2))
        }
      }
    })

    return grams
  }

  /**
   * 基于 TF-IDF 思想与余弦相似度计算光标上下文与历史废稿的契合度
   */
  public static recommendFragments(
    contextText: string,
    fragments: ScrapbookFragmentRecord[],
    topK = 5
  ): ScrapRecommendation[] {
    if (!contextText || fragments.length === 0) return []

    const queryTokens = this.tokenize(contextText)
    if (queryTokens.length === 0) return []

    const queryFreq = new Map<string, number>()
    queryTokens.forEach((t) => queryFreq.set(t, (queryFreq.get(t) || 0) + 1))

    const recommendations: ScrapRecommendation[] = []

    for (const frag of fragments) {
      if (frag.isReused) continue

      const fragTokens = this.tokenize(frag.snippet)
      const fragFreq = new Map<string, number>()
      fragTokens.forEach((t) => fragFreq.set(t, (fragFreq.get(t) || 0) + 1))

      let dotProduct = 0
      const matchedKeywords: string[] = []

      queryFreq.forEach((qCount, word) => {
        const fCount = fragFreq.get(word)
        if (fCount) {
          dotProduct += qCount * fCount
          matchedKeywords.push(word)
        }
      })

      // 计算模长
      let normQ = 0
      queryFreq.forEach((c) => (normQ += c * c))
      let normF = 0
      fragFreq.forEach((c) => (normF += c * c))

      const similarity =
        normQ > 0 && normF > 0 ? dotProduct / (Math.sqrt(normQ) * Math.sqrt(normF)) : 0

      if (similarity > 0.05) {
        recommendations.push({
          fragment: frag,
          similarityScore: Math.round(similarity * 100) / 100,
          matchedKeywords,
        })
      }
    }

    return recommendations.sort((a, b) => b.similarityScore - a.similarityScore).slice(0, topK)
  }
}
