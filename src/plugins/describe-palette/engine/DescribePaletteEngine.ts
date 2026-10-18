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
  sight: [
    '见',
    '望',
    '视',
    '瞧',
    '光',
    '影',
    '芒',
    '色',
    '暗',
    '红',
    '青',
    '蓝',
    '白',
    '黑',
    '耀',
    '照',
    '闪',
    '瞳',
    '眸',
    '亮',
    '阴',
    '璀璨',
    '模糊',
    '清澈',
    '幽暗',
    '斑驳',
    '绚丽',
  ],
  sound: [
    '听',
    '闻',
    '响',
    '声',
    '音',
    '鸣',
    '啸',
    '雷',
    '轰',
    '碎',
    '静',
    '震',
    '呼',
    '吟',
    '嘶',
    '吼',
    '铿',
    '锵',
    '哗',
    '沉闷',
    '尖锐',
    '呼啸',
    '寂静',
    '轰鸣',
    '低语',
  ],
  scent: [
    '嗅',
    '香',
    '臭',
    '腥',
    '气味',
    '芳',
    '焦',
    '馥',
    '芬',
    '气息',
    '膻',
    '刺鼻',
    '泥土',
    '腐朽',
    '血腥',
    '清香',
    '硝烟',
    '焦糊',
    '冷香',
  ],
  taste: [
    '尝',
    '甜',
    '苦',
    '辣',
    '咸',
    '酸',
    '甘',
    '涩',
    '醇',
    '嚼',
    '吞',
    '咽',
    '酒',
    '舌',
    '甘甜',
    '辛辣',
    '焦苦',
    '回甘',
    '生津',
  ],
  touch: [
    '冷',
    '热',
    '温',
    '凉',
    '寒',
    '痛',
    '麻',
    '颤',
    '触',
    '抚',
    '割',
    '冰',
    '硬',
    '软',
    '滑',
    '烫',
    '刺',
    '黏',
    '糙',
    '刺骨',
    '灼热',
    '剧痛',
    '僵硬',
    '湿润',
    '沉重',
  ],
  metaphor: [
    '宛如',
    '恍若',
    '仿佛',
    '犹若',
    '恰似',
    '如同',
    '一样',
    '像是',
    '倒悬',
    '撕裂',
    '凝滞',
    '虚妄',
    '吞噬',
    '如获新生',
    '形如鬼魅',
    '势若奔雷',
  ],
}

export class DescribePaletteEngine {
  private snippets: SensorySnippet[]
  private randomSource: RandomSource
  constructor(customSnippets?: SensorySnippet[], random?: RandomSource) {
    this.snippets = structuredClone(customSnippets ?? (defaultDataset as SensorySnippet[]))
    this.randomSource = random ?? defaultRandomSource
  }
  getAllSnippets(): SensorySnippet[] {
    return structuredClone(this.snippets)
  }
  searchSnippets(
    query: string,
    options?: { genre?: GenreType; sense?: SenseType; limit?: number },
  ): SensorySnippet[] {
    const limit = options?.limit ?? 50
    if (!Number.isSafeInteger(limit) || limit < 0 || limit > 1000)
      throw new Error('检索数量须为 0 至 1000 的整数。')
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const filtered = this.snippets.filter(
      (snippet) =>
        (!options?.genre ||
          options.genre === 'all' ||
          snippet.genre === options.genre ||
          snippet.genre === 'all') &&
        (!options?.sense ||
          snippet.primarySense === options.sense ||
          snippet.secondarySenses?.includes(options.sense)),
    )
    const ranked = filtered
      .map((snippet, index) => {
        const fields = [
          snippet.text,
          snippet.category,
          ...snippet.keywords,
          ...(snippet.tags ?? []),
        ]
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
        const matches = terms.every((term) =>
          fields.some((field) => field.includes(term) || term.includes(field)),
        )
        const direct = terms.filter((term) => snippet.text.toLowerCase().includes(term)).length
        return { snippet, index, matches, direct }
      })
      .filter((entry) => entry.matches)
      .sort((a, b) => b.direct - a.direct || a.index - b.index)
    return structuredClone(ranked.slice(0, limit).map((entry) => entry.snippet))
  }
  diagnoseText(text: string): SensoryDiagnosisReport {
    const radar: SensoryRadarScore = {
      sight: 0,
      sound: 0,
      scent: 0,
      taste: 0,
      touch: 0,
      metaphor: 0,
    }
    const matches: SensoryDiagnosisReport['matches'] = []
    for (const [sense, cues] of Object.entries(SENSORY_DICTIONARY) as [SenseType, string[]][]) {
      const candidates: Array<{ sense: SenseType; quote: string; start: number; end: number }> = []
      for (const cue of [...new Set(cues)].filter(Boolean)) {
        let start = text.indexOf(cue)
        while (start >= 0) {
          candidates.push({ sense, quote: cue, start, end: start + cue.length })
          start = text.indexOf(cue, start + cue.length)
        }
      }
      const accepted: typeof candidates = []
      const occupied = new Uint8Array(text.length)
      for (const candidate of candidates.sort(
        (a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start,
      )) {
        let overlaps = false
        for (let i = candidate.start; i < candidate.end; i++)
          if (occupied[i]) {
            overlaps = true
            break
          }
        if (!overlaps) {
          accepted.push(candidate)
          occupied.fill(1, candidate.start, candidate.end)
        }
      }
      radar[sense] = accepted.length
      matches.push(...accepted)
    }
    const totalHits = Object.values(radar).reduce((sum, n) => sum + n, 0)
    const radarPercentages = Object.fromEntries(
      Object.entries(radar).map(([sense, count]) => [
        sense,
        totalHits ? (count / totalHits) * 100 : 0,
      ]),
    ) as unknown as SensoryRadarScore
    return {
      totalWordCount: Array.from(text.replace(/\s/g, '')).length,
      radar,
      radarPercentages,
      matches: matches.sort((a, b) => a.start - b.start || a.end - b.end),
      inputStatus: text.trim() ? 'provided' : 'empty',
      advice: text.trim()
        ? '词表命中只用于定位，否定、转述和比喻需要结合语境；未命中不等于缺少感官描写。'
        : '没有正文，尚未进行词项定位。',
    }
  }
  inspireRandom(
    genre?: GenreType,
    sense?: SenseType,
    count = 3,
    random?: RandomSource,
    query = '',
  ): SensorySnippet[] {
    if (!Number.isSafeInteger(count) || count < 0 || count > 1000)
      throw new Error('抽取数量须为 0 至 1000 的整数。')
    const available = this.searchSnippets(query, { genre, sense, limit: 1000 })
    const selected: SensorySnippet[] = []
    const rng = random ?? this.randomSource
    while (selected.length < count && available.length) {
      const value = rng.next()
      if (!Number.isFinite(value) || value < 0 || value >= 1)
        throw new Error('随机源须返回 [0,1) 范围内的数值。')
      selected.push(available.splice(Math.floor(value * available.length), 1)[0])
    }
    return selected
  }
}
export const describePaletteEngine = new DescribePaletteEngine()
