// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { CodexGraphStore } from '../../../src/plugins/living-codex/engine/GraphStore'
import type { CodexEntity } from '../../../src/plugins/living-codex/types'
import { NameForgeEngine } from '../../../src/plugins/name-forge/engine/NameForgeEngine'
import { PhoneticsEvaluator } from '../../../src/plugins/name-forge/engine/PhoneticsEvaluator'
import type { RandomSource } from '../../../src/ports/randomSource'
import { ConsistencyEngine } from '../../../src/plugins/consistency-sentinel/engine/ConsistencyEngine'
import type { PowerTierSystem } from '../../../src/plugins/consistency-sentinel/types'
import { ScrapbookEngine } from '../../../src/plugins/scrapbook-recycler/engine/ScrapbookEngine'
import type { ScrapbookFragmentRecord } from '../../../src/plugins/scrapbook-recycler/types'
import { VolumeMasterEngine } from '../../../src/plugins/volume-master/engine/VolumeMasterEngine'
import {
  computeCorpusIdf,
  computeKnapsackOracle,
  computeOlsQuadraticOracle,
  computePosetOracle,
  computeTfIdfCosine,
  PINYIN_TONE_DICTIONARY,
} from '../harness/mathOracles'

const roundTo = (value: number, digits: number): number => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function makeCodexEntity(
  id: string,
  name: string,
  summary: string,
  relations: CodexEntity['relations'] = [],
): CodexEntity {
  return {
    id,
    projectId: 'project-math-engines',
    name,
    aliases: [],
    category: 'term',
    attributes: {},
    relations,
    summary,
    createdAt: 0,
    updatedAt: 0,
  }
}

function makeFragment(
  id: string,
  snippet: string,
  isReused = false,
): ScrapbookFragmentRecord {
  return {
    id,
    projectId: 'project-math-engines',
    snippet,
    wordCount: snippet.length,
    deletedAt: 0,
    tags: [],
    isReused,
  }
}

function estimateSimpleCodexLineTokens(entity: CodexEntity): number {
  const line = `[${entity.category.toUpperCase()}] ${entity.name}: ${entity.summary || '暂无描述'}`
  return Math.ceil(line.length * 0.7) + 4
}

describe('Tier 1: F11-F15 - Real Mathematical and Analysis Engines', () => {
  describe('F11 - ConsistencyEngine Poset DAG', () => {
    it('TC-MATH-11-01: matches the Warshall closure oracle on a branching hierarchy', () => {
      const tiers = ['练气', '筑基', '金丹', '魔丹', '元婴']
      const relations = [
        { lowerTier: '练气', higherTier: '筑基' },
        { lowerTier: '筑基', higherTier: '金丹' },
        { lowerTier: '筑基', higherTier: '魔丹' },
        { lowerTier: '金丹', higherTier: '元婴' },
        { lowerTier: '魔丹', higherTier: '元婴' },
      ]
      const oracle = computePosetOracle(
        tiers.map((id) => ({ id, name: id })),
        relations.map(({ lowerTier, higherTier }) => ({ from: lowerTier, to: higherTier })),
      )
      const engine = new ConsistencyEngine()
      const actualClosure = engine.buildTransitiveClosure(tiers, relations)

      expect(oracle.hasCycle).toBe(false)
      expect(oracle.topologicalOrder).toEqual(['练气', '筑基', '金丹', '魔丹', '元婴'])
      for (const tier of tiers) {
        expect(actualClosure.get(tier)).toEqual(oracle.transitiveClosure.get(tier))
      }

      expect(actualClosure.get('练气')?.has('元婴')).toBe(true)
      expect(actualClosure.get('金丹')?.has('魔丹')).toBe(false)

      const system: PowerTierSystem = {
        projectId: 'project-math-engines',
        systemName: '分支境界体系',
        tiers,
        specialModifiers: [],
        updatedAt: 0,
      }
      expect(engine.compareTiers('练气', '元婴', system, relations)).toBe(-1)
      expect(Number.isNaN(engine.compareTiers('金丹', '魔丹', system, relations))).toBe(true)
    })

    it('TC-MATH-11-02: rejects a cyclic hierarchy in both the oracle and production validator', () => {
      const tiers = ['黄阶', '玄阶', '地阶']
      const relations = [
        { lowerTier: '黄阶', higherTier: '玄阶' },
        { lowerTier: '玄阶', higherTier: '地阶' },
        { lowerTier: '地阶', higherTier: '黄阶' },
      ]
      const oracle = computePosetOracle(
        tiers.map((id) => ({ id, name: id })),
        relations.map(({ lowerTier, higherTier }) => ({ from: lowerTier, to: higherTier })),
      )
      const engine = new ConsistencyEngine()
      const validation = engine.validatePosetDAG(tiers, relations)
      const system: PowerTierSystem = {
        projectId: 'project-math-engines',
        systemName: '循环境界体系',
        tiers,
        specialModifiers: [],
        updatedAt: 0,
      }
      const violations = engine.scanPowerHierarchyCycles(system, relations)

      expect(oracle.hasCycle).toBe(true)
      expect(oracle.topologicalOrder).toEqual([])
      expect(validation.isAcyclic).toBe(false)
      expect(validation.cycles).toContainEqual(['黄阶', '玄阶', '地阶', '黄阶'])
      expect(violations).toHaveLength(1)
      expect(violations[0].type).toBe('power_hierarchy_cycle')
      expect(violations[0].severity).toBe('critical')
      expect(violations[0].snippet).toBe('黄阶 < 玄阶 < 地阶 < 黄阶')
    })
  })

  describe('F12 - CodexGraphStore spreading activation and 0-1 knapsack', () => {
    it('TC-MATH-12-01: selects the maximum-value entity subset under the real token budget', () => {
      const entities = [
        makeCodexEntity(
          'greedy-trap',
          '贪心陷阱实体',
          '一段较长的描述使该实体的 Token 代价较大以构建背包测试',
        ),
        makeCodexEntity('optimal-a', '优选实体甲', '简短描述A'),
        makeCodexEntity('optimal-b', '优选实体乙', '简短描述B'),
      ]
      const store = new CodexGraphStore()
      store.updateDataset(entities)

      const capacity = 36
      const slice = store.resolveContextSlice(
        entities.map((entity) => entity.name).join(' '),
        20 + capacity,
      )
      const oracleItems = entities.map((entity) => ({
        id: entity.id,
        name: entity.name,
        weight: estimateSimpleCodexLineTokens(entity),
        value: entity.name.length * 0.4,
      }))
      const expected = computeKnapsackOracle(oracleItems, capacity)
      const expectedIds = [...expected.selectedItemIds].sort()
      const actualIds = slice.matchedEntities.map((entity) => entity.id).sort()
      const actualValue = slice.matchedEntities.reduce(
        (total, entity) => total + entity.name.length * 0.4,
        0,
      )

      expect(expectedIds).toEqual(['optimal-a', 'optimal-b'])
      expect(actualIds).toEqual(expectedIds)
      expect(slice.xmlContext).toContain('<living_codex_context>')
      expect(slice.totalEstimatedTokens).toBe(20 + expected.totalWeight)
      expect(slice.totalEstimatedTokens).toBeLessThanOrEqual(20 + capacity)
      expect(actualValue).toBeCloseTo(expected.maxValue, 10)
    })

    it('TC-MATH-12-02: propagates one-hop relations and returns an empty slice when capacity is exhausted', () => {
      const source = makeCodexEntity('source', '源头', '直接命中的设定', [
        {
          targetId: 'related',
          targetName: '关联设定',
          relationType: '关联',
        },
      ])
      const related = makeCodexEntity('related', '关联设定', '由拓扑扩散激活的设定')
      const store = new CodexGraphStore()
      store.updateDataset([source, related])

      const expanded = store.resolveContextSlice('源头', 200)
      const noMatch = store.resolveContextSlice('完全不相关的正文', 200)
      const noCapacity = store.resolveContextSlice('源头', 20)

      expect(expanded.matchedEntities.map((entity) => entity.id)).toEqual(['source', 'related'])
      expect(expanded.xmlContext).toContain('关联->关联设定')
      expect(expanded.totalEstimatedTokens).toBeGreaterThan(20)
      expect(noMatch).toEqual({ matchedEntities: [], xmlContext: '', totalEstimatedTokens: 0 })
      expect(noCapacity).toEqual({ matchedEntities: [], xmlContext: '', totalEstimatedTokens: 0 })
    })
  })

  describe('F13 - ScrapbookEngine deletion threshold and similarity', () => {
    it('TC-MATH-13-01: extracts exactly-threshold deletions and rejects shorter edits', () => {
      const exactDeletion = '123456789012345'
      const extracted = ScrapbookEngine.extractDeletedFragments(
        `keep<${exactDeletion}>tail`,
        'keep<>tail',
        'chapter-1',
        '第一章',
      )
      const belowThreshold = ScrapbookEngine.extractDeletedFragments(
        'keep<12345678901234>tail',
        'keep<>tail',
      )

      expect(extracted).toHaveLength(1)
      expect(extracted[0]).toMatchObject({
        snippet: exactDeletion,
        wordCount: 15,
        sourceChapterId: 'chapter-1',
        sourceChapterTitle: '第一章',
        isReused: false,
      })
      expect(extracted[0].tags).toEqual(['123456789012345', '12', '23', '34'])
      expect(belowThreshold).toEqual([])
    })

    it('TC-MATH-13-02: matches the corpus TF-IDF oracle where the corpus IDF is uniform', () => {
      const contextText = '夜雨 古刹'
      const target = makeFragment('scrap-target', '夜雨 古刹 风雷')
      const weaker = makeFragment('scrap-weaker', '夜雨 古刹 风雷 风雷')
      const fragments = [target, weaker]
      const documents = fragments.map((fragment) => ({
        id: fragment.id,
        text: fragment.snippet,
        tokens: ScrapbookEngine.tokenize(fragment.snippet),
      }))
      const idf = computeCorpusIdf(documents)
      const expectedScore = computeTfIdfCosine(
        ScrapbookEngine.tokenize(contextText),
        ScrapbookEngine.tokenize(target.snippet),
        idf,
      )
      const recommendations = ScrapbookEngine.recommendFragments(contextText, fragments, 1)

      expect(idf.get('夜雨')).toBeCloseTo(idf.get('风雷')!, 10)
      expect(expectedScore).toBeCloseTo(2 / Math.sqrt(6), 10)
      expect(recommendations).toHaveLength(1)
      expect(recommendations[0].fragment.id).toBe('scrap-target')
      expect(recommendations[0].similarityScore).toBe(roundTo(expectedScore, 2))
      expect(recommendations[0].matchedKeywords).toEqual(['夜雨', '古刹'])
    })

    it('TC-MATH-13-03: returns no recommendation for empty-token context or already reused fragments', () => {
      const reused = makeFragment('reused', '夜雨 古刹 风雷', true)
      const fresh = makeFragment('fresh', '夜雨 古刹 风雷')

      expect(ScrapbookEngine.recommendFragments('', [fresh])).toEqual([])
      expect(ScrapbookEngine.recommendFragments('，！？', [fresh])).toEqual([])
      expect(ScrapbookEngine.recommendFragments('夜雨 古刹', [reused])).toEqual([])
    })
  })

  describe('F14 - PhoneticsEvaluator and NameForge integration', () => {
    it('TC-MATH-14-01: maps dictionary tones and computes a real compound-name pattern', () => {
      const dictionarySamples = ['锋', '尊', '岳', '天', '云', '剑', '影', '海']
      for (const char of dictionarySamples) {
        expect(PhoneticsEvaluator.getTone(char)).toBe(PINYIN_TONE_DICTIONARY[char])
      }

      const name = '楚凌霄'
      const analysis = PhoneticsEvaluator.analyzeToneFluctuation(name)
      const harmony = PhoneticsEvaluator.evaluatePhonetics(name)

      expect(PhoneticsEvaluator.getTonePattern(name)).toBe('仄平平')
      expect(analysis).toMatchObject({
        pattern: '仄平平',
        isAlternating: true,
        hasAdjacentIdentical: false,
        cadence: 'ping',
      })
      expect(analysis.pingRatio).toBeCloseTo(2 / 3, 10)
      expect(harmony).toMatchObject({ score: 95, pattern: '仄平平' })
      expect(harmony.toneVibe).toContain('平声收韵')
    })

    it('TC-MATH-14-02: handles empty phonetics input and carries the real score into generated names', () => {
      expect(PhoneticsEvaluator.analyzeToneFluctuation('')).toEqual({
        pattern: '',
        isAlternating: false,
        hasAdjacentIdentical: false,
        cadence: 'empty',
        pingRatio: 0,
      })
      expect(PhoneticsEvaluator.evaluatePhonetics('')).toEqual({
        score: 70,
        pattern: '',
        toneVibe: '音韵平正',
      })

      const deterministicRandom: RandomSource = { next: () => 0.1 }
      const generated = new NameForgeEngine(deterministicRandom).generateNames({
        category: 'character_cn',
        style: 'ethereal',
        count: 1,
        fixedPrefix: '楚',
        fixedKern: '凌',
      })
      const item = generated[0]
      const recomputed = PhoneticsEvaluator.evaluatePhonetics(item.name)

      expect(generated).toHaveLength(1)
      expect(item.name.startsWith('楚')).toBe(true)
      expect(item.phoneticsScore).toBe(recomputed.score)
      expect(item.meaningOrVibe).toContain(`【${recomputed.pattern}】`)
    })
  })

  describe('F15 - VolumeMasterEngine OLS narrative arcs', () => {
    it('TC-MATH-15-01: matches exact quadratic coefficients, fit, and apex against the OLS oracle', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 0.5, y: 1 },
        { x: 1, y: 0 },
      ]
      const oracle = computeOlsQuadraticOracle(points)
      const actual = new VolumeMasterEngine().computeOlsQuadratic(points)

      expect(actual.beta0).toBeCloseTo(0, 8)
      expect(actual.beta1).toBeCloseTo(4, 8)
      expect(actual.beta2).toBeCloseTo(-4, 8)
      expect(actual.r2).toBeCloseTo(1, 8)
      expect(actual.apexRatio).toBeCloseTo(0.5, 8)
      expect(actual.beta0).toBeCloseTo(oracle.beta0, 8)
      expect(actual.beta1).toBeCloseTo(oracle.beta1, 8)
      expect(actual.beta2).toBeCloseTo(oracle.beta2, 8)
      expect(actual.r2).toBeCloseTo(oracle.r2, 8)
      expect(actual.apexRatio).toBeCloseTo(oracle.apexRatio, 8)
    })

    it('TC-MATH-15-02: returns the defined fallback for underdetermined and flat curves', () => {
      const engine = new VolumeMasterEngine()
      const underdetermined = [{ x: 0, y: 1 }, { x: 1, y: 2 }]
      const underdeterminedOracle = computeOlsQuadraticOracle(underdetermined)
      const underdeterminedActual = engine.computeOlsQuadratic(underdetermined)
      const flatPoints = [
        { x: 0, y: 5 },
        { x: 0.5, y: 5 },
        { x: 1, y: 5 },
      ]
      const flatOracle = computeOlsQuadraticOracle(flatPoints)
      const flatActual = engine.computeOlsQuadratic(flatPoints)

      expect(underdeterminedActual).toEqual(underdeterminedOracle)
      expect(flatActual.beta0).toBeCloseTo(flatOracle.beta0, 8)
      expect(flatActual.beta1).toBeCloseTo(flatOracle.beta1, 8)
      expect(flatActual.beta2).toBeCloseTo(flatOracle.beta2, 8)
      expect(flatActual.r2).toBe(1)
      expect(flatActual.apexRatio).toBe(-1)
      expect(engine.fitNarrativeArcR2([5, 5, 5])).toEqual({
        r2: 1,
        apexPositionRatio: 0,
      })
    })

    it('TC-MATH-15-03: exposes oracle-derived rounded regression metrics through volume statistics', () => {
      const engine = new VolumeMasterEngine()
      const tensions = [0.2, 0.8, 1, 0.8, 0.2]
      const points = tensions.map((y, index) => ({
        x: index / (tensions.length - 1),
        y,
      }))
      const oracle = computeOlsQuadraticOracle(points)
      const arc = engine.fitNarrativeArcR2(tensions)
      const stat = engine.calculateVolumeStat(
        { id: 'volume-1', title: '测试卷', order: 1 },
        tensions.map((tension) => ({ volumeId: 'volume-1', wordCount: 100, tension })),
      )

      expect(arc).toEqual({
        r2: roundTo(oracle.r2, 3),
        apexPositionRatio: roundTo(Math.max(0, Math.min(1, oracle.apexRatio)), 3),
      })
      expect(stat.arcRegression).toEqual({
        beta0: roundTo(oracle.beta0, 3),
        beta1: roundTo(oracle.beta1, 3),
        beta2: roundTo(oracle.beta2, 3),
        r2: roundTo(oracle.r2, 3),
        apexRatio: roundTo(Math.max(0, Math.min(1, oracle.apexRatio)), 3),
      })
      expect(stat.actualWordCount).toBe(500)
      expect(stat.chapterCount).toBe(5)
    })
  })
})
