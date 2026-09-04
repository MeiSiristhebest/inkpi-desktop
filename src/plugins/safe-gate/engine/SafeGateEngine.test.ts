import { describe, it, expect, beforeEach } from 'vitest'
import { SafeGateEngine } from './SafeGateEngine'
import type { SensitiveWord, RegexRule } from '../types'

describe('SafeGateEngine — 三级敏感词匹配与逆序文学平替算法', () => {
  let engine: SafeGateEngine

  const sampleWords: SensitiveWord[] = [
    {
      id: 'w1',
      word: '血肉横飞',
      level: 'yellow',
      category: '暴力',
      literaryAlternatives: [
        { replacement: '气劲溃散', genre: ['xianxia'], confidence: 0.95 },
        { replacement: '死伤枕藉', genre: ['historical'], confidence: 0.9 },
      ],
    },
    {
      id: 'w2',
      word: '反党',
      level: 'red',
      category: '政治',
      literaryAlternatives: [
        { replacement: '离经叛道', genre: ['neutral'], confidence: 0.9 },
      ],
    },
    {
      id: 'w3',
      word: '政府',
      level: 'blue',
      category: '出戏词',
      literaryAlternatives: [
        { replacement: '仙盟执事堂', genre: ['xianxia'], confidence: 0.95 },
        { replacement: '朝廷', genre: ['historical'], confidence: 0.9 },
      ],
    },
  ]

  const sampleRules: RegexRule[] = [
    {
      id: 'r1',
      pattern: '河[\\s\\W_]*蟹',
      flags: 'gi',
      level: 'yellow',
      category: '谐音',
      literaryAlternatives: [
        { replacement: '抹平痕迹', genre: ['neutral'], confidence: 0.9 },
      ],
    },
  ]

  beforeEach(() => {
    engine = new SafeGateEngine()
    engine.build(sampleWords, sampleRules)
  })

  it('scans text and detects both exact AC matches and regex patterns', () => {
    const text = '前方战场血肉横飞，消息很快被河  蟹了，连政府也介入调查。'
    const result = engine.scan(text, 'xianxia')

    expect(result.isClean).toBe(false)
    expect(result.violations.length).toBe(3)
    expect(result.yellowCount).toBe(2)
    expect(result.blueCount).toBe(1)
    expect(result.redCount).toBe(0)

    const matchedWords = result.violations.map((v) => v.matchedText)
    expect(matchedWords).toContain('血肉横飞')
    expect(matchedWords).toContain('河  蟹')
    expect(matchedWords).toContain('政府')
  })

  it('sorts suggestions prioritizing current novel genre', () => {
    const text = '这里的政府管辖极严。'
    const resultXianxia = engine.scan(text, 'xianxia')
    expect(resultXianxia.violations[0].suggestions[0].replacement).toBe('仙盟执事堂')

    const resultHist = engine.scan(text, 'historical')
    expect(resultHist.violations[0].suggestions[0].replacement).toBe('朝廷')
  })

  it('applies single replacement accurately using exact slice index', () => {
    const text = '战场上血肉横飞，惨不忍睹。'
    const result = engine.scan(text, 'xianxia')
    const replaced = engine.applyReplacement(
      text,
      result.violations[0],
      result.violations[0].suggestions[0],
    )

    expect(replaced).toBe('战场上气劲溃散，惨不忍睹。')
  })

  it('CRITICAL: performs backward batch replacement without offset drifting', () => {
    // 文本中包含多个位置不同的敏感词
    const text = '开始[政府]中间[血肉横飞]结束[河_蟹]完毕'
    const result = engine.scan(text, 'xianxia')
    expect(result.violations.length).toBe(3)

    // 批量平替（必须从后往前替换，否则前面的替换会破坏后面词汇的偏移量）
    const finalCleanText = engine.applyAllAuto(text, result, 'xianxia')

    expect(finalCleanText).toBe('开始[仙盟执事堂]中间[气劲溃散]结束[抹平痕迹]完毕')
    expect(finalCleanText).not.toContain('政府')
    expect(finalCleanText).not.toContain('血肉横飞')
    expect(finalCleanText).not.toContain('河_蟹')
  })

  it('handles empty or clean text gracefully', () => {
    expect(engine.scan('').isClean).toBe(true)
    expect(engine.scan('清风拂过山岗，明月照耀大江。').isClean).toBe(true)
  })
})
