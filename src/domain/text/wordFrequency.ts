// 中文分词与高频词/口癖统计（领域层纯函数，无DOM依赖）

/** 常见中文虚词、代词、介词与助词过滤表（避免高频词全是“的了在是个”） */
const CHINESE_STOP_WORDS = new Set([
  '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
  '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
  '自己', '这', '那', '它', '他', '她', '他们', '她们', '我们', '你们', '这个',
  '那个', '这样', '那样', '因为', '所以', '如果', '但是', '然后', '而且', '虽然',
  '或者', '还是', '什么', '怎么', '怎样', '为什么', '虽说', '不过', '只是',
  '只见', '只见那', '却见', '只见得', '顿时', '此时', '便', '又', '乃',
  '之', '其', '于', '与', '及', '以', '为', '而', '则', '矣', '焉', '哉'
])

export interface WordFrequencyItem {
  word: string
  count: number
  percentage: number
}

export interface WordAnalysisResult {
  totalTokens: number
  uniqueWords: number
  topWords: WordFrequencyItem[]
}

/**
 * 分析文本的高频词分布（优先使用国际标准现代环境自带的 Intl.Segmenter 中文词切分）
 * @param text 纯文本
 * @param topLimit 提取前 N 个高频词，默认 15 个
 */
export function analyzeWordFrequency(text: string, topLimit = 15): WordAnalysisResult {
  if (!text || !text.trim()) {
    return { totalTokens: 0, uniqueWords: 0, topWords: [] }
  }

  const cleanText = text.replace(/[\r\n\t]/g, ' ')
  const wordCounts = new Map<string, number>()
  let totalValidWords = 0

  // 1. 优先使用标准 Intl.Segmenter（现代浏览器/Node环境原生支持，无需引入几十MB的第三方词库）
  if (typeof Intl !== 'undefined' && (Intl as any).Segmenter) {
    const segmenter = new (Intl as any).Segmenter('zh-CN', { granularity: 'word' })
    const segments = segmenter.segment(cleanText)

    for (const seg of segments) {
      if (!seg.isWordLike) continue
      const word = seg.segment.trim()
      // 过滤单字符标点/单字助词、纯数字及通用停用词
      if (word.length < 2) continue
      if (/^\d+$/.test(word)) continue
      if (CHINESE_STOP_WORDS.has(word)) continue

      totalValidWords++
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1)
    }
  } else {
    // 2. 备用算法：2~4 字中文 n-gram 滑动窗口
    const chineseChunks = cleanText.match(/[\u4e00-\u9fa5]+/g) || []
    for (const chunk of chineseChunks) {
      if (chunk.length < 2) continue
      for (let len = 2; len <= Math.min(4, chunk.length); len++) {
        for (let i = 0; i <= chunk.length - len; i++) {
          const w = chunk.substring(i, i + len)
          if (!CHINESE_STOP_WORDS.has(w)) {
            totalValidWords++
            wordCounts.set(w, (wordCounts.get(w) || 0) + 1)
          }
        }
      }
    }
  }

  // 排序并格式化 Top 词频
  const sorted = Array.from(wordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topLimit)

  const topWords: WordFrequencyItem[] = sorted.map(([word, count]) => ({
    word,
    count,
    percentage: totalValidWords > 0 ? Number(((count / totalValidWords) * 100).toFixed(1)) : 0,
  }))

  return {
    totalTokens: totalValidWords,
    uniqueWords: wordCounts.size,
    topWords,
  }
}
