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
   * 基于语料库级平滑逆文档频率 (Smoothed Corpus-level IDF) 与 TF-IDF 余弦相似度计算光标上下文与历史废稿的契合度
   *
   * 平滑公式：
   * IDF(t) = ln((1 + N) / (1 + df(t))) + 1
   * 其中 N 为语料库片段总数，df(t) 为包含词项 t 的片段文档频数。
   */
  public static recommendFragments(
    contextText: string,
    fragments: ScrapbookFragmentRecord[],
    topK = 5
  ): ScrapRecommendation[] {
    if (!contextText || fragments.length === 0) return []

    // 过滤掉已复用的废稿，构建当前有效语料库
    const activeFragments = fragments.filter((f) => !f.isReused)
    if (activeFragments.length === 0) return []

    const queryTokens = this.tokenize(contextText)
    if (queryTokens.length === 0) return []

    // 1. 计算语料库级平滑逆文档频率 (Corpus-level Smoothed IDF)
    const N = activeFragments.length
    const docFrequencies = new Map<string, number>()
    const fragTokenMaps: Array<{ frag: ScrapbookFragmentRecord; tfMap: Map<string, number> }> = []

    for (const frag of activeFragments) {
      const fragTokens = this.tokenize(frag.snippet)
      const tfMap = new Map<string, number>()
      for (const t of fragTokens) {
        tfMap.set(t, (tfMap.get(t) || 0) + 1)
      }
      fragTokenMaps.push({ frag, tfMap })

      // 统计文档频率 df (每个文档内仅记 1 次)
      for (const word of tfMap.keys()) {
        docFrequencies.set(word, (docFrequencies.get(word) || 0) + 1)
      }
    }

    // 辅助计算 IDF：IDF(t) = ln((1 + N) / (1 + df(t))) + 1
    const getSmoothedIdf = (term: string): number => {
      const df = docFrequencies.get(term) || 0
      return Math.log((1 + N) / (1 + df)) + 1
    }

    // 2. 计算查询文本 (Context Text) 的 TF-IDF 向量与模长
    const queryTfMap = new Map<string, number>()
    for (const t of queryTokens) {
      queryTfMap.set(t, (queryTfMap.get(t) || 0) + 1)
    }

    const queryVector = new Map<string, number>()
    let normQ2 = 0
    for (const [term, count] of queryTfMap.entries()) {
      const idf = getSmoothedIdf(term)
      const tfIdf = count * idf
      queryVector.set(term, tfIdf)
      normQ2 += tfIdf * tfIdf
    }
    const normQ = Math.sqrt(normQ2)
    if (normQ === 0) return []

    // 3. 计算每个候选废稿片段的 TF-IDF 向量并求余弦相似度
    const recommendations: ScrapRecommendation[] = []

    for (const { frag, tfMap } of fragTokenMaps) {
      let dotProduct = 0
      let normD2 = 0
      const matchedKeywords: string[] = []

      for (const [term, count] of tfMap.entries()) {
        const idf = getSmoothedIdf(term)
        const tfIdf = count * idf
        normD2 += tfIdf * tfIdf

        const qVal = queryVector.get(term)
        if (qVal !== undefined) {
          dotProduct += qVal * tfIdf
          matchedKeywords.push(term)
        }
      }

      const normD = Math.sqrt(normD2)
      const similarity = normD > 0 ? dotProduct / (normQ * normD) : 0

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
