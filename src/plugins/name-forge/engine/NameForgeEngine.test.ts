import { describe, it, expect } from 'vitest'
import { NameForgeEngine } from './NameForgeEngine'
import { PhoneticsEvaluator } from './PhoneticsEvaluator'
import type { RandomSource } from '../../../ports/randomSource'

describe('NameForgeEngine — 中西奇幻起名姬算法引擎', () => {
  const engine = new NameForgeEngine()

  it('generates chinese character names with high phonetics score', () => {
    const list = engine.generateNames({ category: 'character_cn', count: 5, style: 'cold_sharp' })
    expect(list.length).toBe(5)
    for (const item of list) {
      expect(item.name.length).toBeGreaterThanOrEqual(2)
      expect(item.phoneticsScore).toBeGreaterThanOrEqual(70)
      expect(item.meaningOrVibe).toBeTruthy()
    }
  })

  it('supports fixed surname prefix and generation style', () => {
    const list = engine.generateNames({
      category: 'character_cn',
      count: 3,
      fixedPrefix: '楚',
      style: 'ethereal',
    })
    expect(list.length).toBe(3)
    expect(list.every((item) => item.name.startsWith('楚'))).toBe(true)
  })

  it('generates western character names with first and last parts', () => {
    const list = engine.generateNames({
      category: 'character_western',
      count: 4,
      gender: 'female',
    })
    expect(list.length).toBe(4)
    expect(list.every((item) => item.name.includes('·'))).toBe(true)
  })

  it('generates sect and factions', () => {
    const list = engine.generateNames({ category: 'sect_faction', count: 3 })
    expect(list.length).toBe(3)
    expect(list[0].category).toBe('sect_faction')
  })

  it('generates techniques and spells', () => {
    const list = engine.generateNames({ category: 'technique_spell', count: 3 })
    expect(list.length).toBe(3)
    expect(list[0].category).toBe('technique_spell')
  })

  it('generates artifacts and locations', () => {
    const artifacts = engine.generateNames({ category: 'item_artifact', count: 3 })
    expect(artifacts.length).toBe(3)
    const locations = engine.generateNames({ category: 'location_realm', count: 3 })
    expect(locations.length).toBe(3)
  })

  it('works deterministically when given a mocked RandomSource', () => {
    const mockRng: RandomSource = {
      next: () => 0.1,
    }
    const res1 = engine.generateNames({ category: 'character_cn', count: 2 }, mockRng)
    const res2 = engine.generateNames({ category: 'character_cn', count: 2 }, mockRng)
    expect(res1[0].name).toEqual(res2[0].name)
  })

  describe('PhoneticsEvaluator — 音律学真值与平仄声调起伏校验', () => {
    it('accurately maps tones according to standard Mandarin phonetics (Tones 1,2=ping, 3,4=ze)', () => {
      // 阴平(1)、阳平(2) 为平声
      expect(PhoneticsEvaluator.getTone('天')).toBe('ping') // tiān (1)
      expect(PhoneticsEvaluator.getTone('云')).toBe('ping') // yún (2)
      expect(PhoneticsEvaluator.getTone('龙')).toBe('ping') // lóng (2)
      expect(PhoneticsEvaluator.getTone('清')).toBe('ping') // qīng (1)
      expect(PhoneticsEvaluator.getTone('凌')).toBe('ping') // líng (2)
      expect(PhoneticsEvaluator.getTone('霄')).toBe('ping') // xiāo (1)
      expect(PhoneticsEvaluator.getTone('锋')).toBe('ping') // fēng (1)
      expect(PhoneticsEvaluator.getTone('尊')).toBe('ping') // zūn (1)

      // 上声(3)、去声(4) 为仄声
      expect(PhoneticsEvaluator.getTone('楚')).toBe('ze') // chǔ (3)
      expect(PhoneticsEvaluator.getTone('墨')).toBe('ze') // mò (4)
      expect(PhoneticsEvaluator.getTone('剑')).toBe('ze') // jiàn (4)
      expect(PhoneticsEvaluator.getTone('圣')).toBe('ze') // shèng (4)
      expect(PhoneticsEvaluator.getTone('岳')).toBe('ze') // yuè (4)
      expect(PhoneticsEvaluator.getTone('霸')).toBe('ze') // bà (4)
      expect(PhoneticsEvaluator.getTone('海')).toBe('ze') // hǎi (3)
      expect(PhoneticsEvaluator.getTone('道')).toBe('ze') // dào (4)
    })

    it('replaces Unicode parity heuristic with genuine phonetics dictionary', () => {
      // 在旧奇偶算法中，charCodeAt(0) % 2 会产生荒谬错误
      // 验证'锋' (Unicode 38155, 38155%2=1 -> 曾被误判为ze，实际为阴平ping)
      expect('锋'.charCodeAt(0) % 2).toBe(1)
      expect(PhoneticsEvaluator.getTone('锋')).toBe('ping')

      // 验证'尊' (Unicode 23562, 23562%2=0 -> 曾被粗糙处理，实际严格为阴平ping)
      expect(PhoneticsEvaluator.getTone('尊')).toBe('ping')

      // 验证'岳' (Unicode 23731, 23731%2=1 -> 实际为去声ze)
      expect(PhoneticsEvaluator.getTone('岳')).toBe('ze')
    })

    it('generates correct tone pattern string for compound names', () => {
      expect(PhoneticsEvaluator.getTonePattern('楚凌霄')).toBe('仄平平')
      expect(PhoneticsEvaluator.getTonePattern('李青云')).toBe('仄平平') // 李(3) 青(1) 云(2)
      expect(PhoneticsEvaluator.getTonePattern('叶剑圣')).toBe('仄仄仄') // 叶(4) 剑(4) 圣(4)
      expect(PhoneticsEvaluator.getTonePattern('萧风')).toBe('平平') // 萧(1) 风(1)
    })

    it('analyzes tone fluctuation and cadence characteristics', () => {
      const analysis1 = PhoneticsEvaluator.analyzeToneFluctuation('楚凌霄')
      expect(analysis1.pattern).toBe('仄平平')
      expect(analysis1.isAlternating).toBe(true)
      expect(analysis1.hasAdjacentIdentical).toBe(false)
      expect(analysis1.cadence).toBe('ping')
      expect(analysis1.pingRatio).toBeCloseTo(2 / 3, 2)

      const analysis2 = PhoneticsEvaluator.analyzeToneFluctuation('叶剑圣')
      expect(analysis2.pattern).toBe('仄仄仄')
      expect(analysis2.isAlternating).toBe(false)
      expect(analysis2.cadence).toBe('ze')
      expect(analysis2.pingRatio).toBe(0)

      const analysisEmpty = PhoneticsEvaluator.analyzeToneFluctuation('')
      expect(analysisEmpty.pattern).toBe('')
      expect(analysisEmpty.cadence).toBe('empty')
    })

    it('evaluates phonetics harmony score with tone variety and penalties', () => {
      const balancedRes = PhoneticsEvaluator.evaluatePhonetics('楚凌霄')
      expect(balancedRes.score).toBeGreaterThanOrEqual(80)
      expect(balancedRes.pattern).toBe('仄平平')
      expect(balancedRes.toneVibe).toContain('平声收韵')

      const repeatedRes = PhoneticsEvaluator.evaluatePhonetics('云云')
      // 连续相同字符受到拗口惩罚
      expect(repeatedRes.score).toBeLessThan(balancedRes.score)

      const emptyRes = PhoneticsEvaluator.evaluatePhonetics('')
      expect(emptyRes.score).toBe(70)
    })
  })
})
