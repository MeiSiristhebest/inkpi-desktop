// 五感微观修辞调色盘引擎
// 提供倒排索引检索、感官雷达诊断与灵感抽卡算法

import type {
  SensorySnippet,
  SenseType,
  GenreType,
  SensoryDiagnosisReport,
  SensoryRadarScore,
} from '../types'
import defaultDataset from '../data/sensory-dataset.json'
import type { RandomSource } from '../../../ports/randomSource'
import { randomSource as defaultRandomSource } from '../../../adapters/randomSource'

const SENSORY_DICTIONARY: Record<SenseType, string[]> = {
  sight: ['见', '望', '视', '瞧', '光', '影', '芒', '色', '暗', '红', '青', '蓝', '白', '黑', '耀', '照', '闪', '瞳', '眸', '亮', '阴'],
  sound: ['听', '闻', '响', '声', '音', '鸣', '啸', '雷', '轰', '碎', '静', '震', '呼', '吟', '嘶', '吼', '铿', '锵', '哗'],
  scent: ['嗅', '香', '臭', '腥', '气味', '芳', '焦', '馥', '芬', '气息', '膻', '刺鼻', '泥土'],
  taste: ['尝', '甜', '苦', '辣', '咸', '酸', '甘', '涩', '醇', '嚼', '吞', '咽', '酒', '舌'],
  touch: ['冷', '热', '温', '凉', '寒', '痛', '麻', '颤', '触', '抚', '割', '冰', '硬', '软', '滑', '烫', '刺', '黏', '糙'],
  metaphor: ['宛如', '恍若', '仿佛', '犹若', '恰似', '如同', '一样', '像是', '倒悬', '撕裂', '凝滞', '虚妄', '吞噬'],
}

export class DescribePaletteEngine {
  private snippets: SensorySnippet[]
  private randomSource: RandomSource

  constructor(customSnippets?: SensorySnippet[], random?: RandomSource) {
    this.snippets = customSnippets && customSnippets.length > 0 ? customSnippets : (defaultDataset as SensorySnippet[])
    this.randomSource = random || defaultRandomSource
  }

  /**
   * 获取所有语料金句
   */
  public getAllSnippets(): SensorySnippet[] {
    return this.snippets
  }

  /**
   * 倒排索引与多维打分检索
   */
  public searchSnippets(
    query: string,
    options?: { genre?: GenreType; sense?: SenseType; limit?: number },
  ): SensorySnippet[] {
    const trimmedQuery = query.trim().toLowerCase()
    const targetGenre = options?.genre || 'all'
    const targetSense = options?.sense
    const limit = options?.limit || 50

    // 过滤题材
    let pool = this.snippets
    if (targetGenre !== 'all') {
      pool = pool.filter((s) => s.genre === targetGenre || s.genre === 'all')
    }
    if (targetSense) {
      pool = pool.filter(
        (s) => s.primarySense === targetSense || s.secondarySenses?.includes(targetSense),
      )
    }

    if (!trimmedQuery) {
      return pool.slice(0, limit)
    }

    // 针对 query 打分
    const scored = pool
      .map((item) => {
        let score = 0
        const textLower = item.text.toLowerCase()
        const categoryLower = item.category.toLowerCase()

        // 关键词命中
        for (const kw of item.keywords) {
          if (trimmedQuery.includes(kw.toLowerCase()) || kw.toLowerCase().includes(trimmedQuery)) {
            score += 30
          }
        }

        // 标签命中
        if (item.tags) {
          for (const tg of item.tags) {
            if (trimmedQuery.includes(tg.toLowerCase()) || tg.toLowerCase().includes(trimmedQuery)) {
              score += 20
            }
          }
        }

        // 文本子串包含
        if (textLower.includes(trimmedQuery)) {
          score += 25
        }

        // 分类匹配
        if (categoryLower.includes(trimmedQuery)) {
          score += 15
        }

        return { item, score }
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.item)

    return scored.slice(0, limit)
  }

  /**
   * 诊断文本的五感雷达分布并生成文学建议
   */
  public diagnoseText(text: string): SensoryDiagnosisReport {
    const cleanText = text.trim()
    const totalWordCount = cleanText.replace(/\s+/g, '').length

    const radar: SensoryRadarScore = {
      sight: 0,
      sound: 0,
      scent: 0,
      taste: 0,
      touch: 0,
      metaphor: 0,
    }

    if (totalWordCount === 0) {
      return {
        totalWordCount: 0,
        radar,
        radarPercentages: radar,
        dominantSense: null,
        missingSenses: ['sight', 'sound', 'scent', 'taste', 'touch', 'metaphor'],
        advice: '输入文本为空，请在上方输入或在编辑器中创作一段正文以启动感官诊断。',
        suggestedSnippets: this.snippets.slice(0, 3),
      }
    }

    // 统计各感官特征词频
    for (const [senseKey, wordList] of Object.entries(SENSORY_DICTIONARY) as [SenseType, string[]][]) {
      let count = 0
      for (const cue of wordList) {
        let idx = cleanText.indexOf(cue)
        while (idx !== -1) {
          count++
          idx = cleanText.indexOf(cue, idx + cue.length)
        }
      }
      radar[senseKey] = count
    }

    const totalHits = Object.values(radar).reduce((sum, v) => sum + v, 0)
    const radarPercentages: SensoryRadarScore = {
      sight: totalHits > 0 ? Math.round((radar.sight / totalHits) * 100) : 0,
      sound: totalHits > 0 ? Math.round((radar.sound / totalHits) * 100) : 0,
      scent: totalHits > 0 ? Math.round((radar.scent / totalHits) * 100) : 0,
      taste: totalHits > 0 ? Math.round((radar.taste / totalHits) * 100) : 0,
      touch: totalHits > 0 ? Math.round((radar.touch / totalHits) * 100) : 0,
      metaphor: totalHits > 0 ? Math.round((radar.metaphor / totalHits) * 100) : 0,
    }

    // 主感官
    let maxSense: SenseType | null = null
    let maxVal = -1
    for (const [key, val] of Object.entries(radar) as [SenseType, number][]) {
      if (val > maxVal && val > 0) {
        maxVal = val
        maxSense = key
      }
    }

    // 缺失感官（词频为 0，或在总检出 > 5 时百分比低于 8%）
    const missingSenses: SenseType[] = []
    const senses: SenseType[] = ['sight', 'sound', 'scent', 'taste', 'touch', 'metaphor']
    for (const s of senses) {
      if (radar[s] === 0 || (totalHits >= 5 && radarPercentages[s] < 8)) {
        missingSenses.push(s)
      }
    }

    // 生成专业文学建议
    let advice = ''
    if (totalHits === 0) {
      advice = '当前段落几乎完全缺乏具象五感描写，容易陷入纯心理独白或平铺直叙，建议补充光影（视觉）与环境声（听觉）。'
    } else if (maxSense === 'sight' && missingSenses.includes('touch') && missingSenses.includes('scent')) {
      advice = '视觉镜头感非常强烈，但触觉体感与环境气味缺席。适度增添温差、风压、冷汗或血腥焦糊气味，可使场景立体沉浸。'
    } else if (maxSense === 'sound' && missingSenses.includes('sight')) {
      advice = '声效渲染逼真，但缺乏直观画面勾勒。建议配合远近光影或色彩对比，形成声画交融的电影质感。'
    } else if (missingSenses.length <= 1) {
      advice = '五感维度分布均衡，通感与细节丰富，现场临场感与文学张力极佳。'
    } else {
      const missingNames = missingSenses
        .slice(0, 3)
        .map((s) => ({ sight: '视觉', sound: '听觉', scent: '嗅觉', taste: '味觉', touch: '触觉', metaphor: '意象通感' })[s])
        .join('、')
      advice = `当前描写较为偏向单一维度，缺少 ${missingNames} 维度的刺激。建议根据场景氛围引入相应细节修辞。`
    }

    // 推荐针对缺失感官的修辞金句
    const suggestedSnippets: SensorySnippet[] = []
    for (const ms of missingSenses) {
      const match = this.snippets.find((item) => item.primarySense === ms)
      if (match && !suggestedSnippets.some((s) => s.id === match.id)) {
        suggestedSnippets.push(match)
      }
      if (suggestedSnippets.length >= 3) break
    }

    return {
      totalWordCount,
      radar,
      radarPercentages,
      dominantSense: maxSense,
      missingSenses,
      advice,
      suggestedSnippets,
    }
  }

  /**
   * 灵感随机抽卡（通过 RandomSource 保证纯洁性）
   */
  public inspireRandom(
    genre?: GenreType,
    sense?: SenseType,
    count: number = 3,
    random?: RandomSource,
  ): SensorySnippet[] {
    const rng = random || this.randomSource
    let pool = [...this.snippets]
    if (genre && genre !== 'all') {
      pool = pool.filter((s) => s.genre === genre || s.genre === 'all')
    }
    if (sense) {
      pool = pool.filter((s) => s.primarySense === sense)
    }

    if (pool.length <= count) {
      return pool
    }

    // 随机采样
    const selected: SensorySnippet[] = []
    const available = [...pool]
    for (let i = 0; i < count && available.length > 0; i++) {
      const randIndex = Math.floor(rng.next() * available.length)
      selected.push(available[randIndex])
      available.splice(randIndex, 1)
    }

    return selected
  }
}

export const describePaletteEngine = new DescribePaletteEngine()
