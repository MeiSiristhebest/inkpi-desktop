import { describe, it, expect } from 'vitest'
import { CodexGraphStore } from './GraphStore'
import type { CodexEntity } from '../types'

describe('CodexGraphStore Topology & Context Slicing', () => {
  const sampleEntities: CodexEntity[] = [
    {
      id: 'char-chen',
      projectId: 'p1',
      name: '陈渊',
      aliases: ['渊哥'],
      category: 'character',
      attributes: { realm: '淬体九重' },
      relations: [
        { targetId: 'char-xiao', targetName: '萧景行', relationType: '宿敌' },
        { targetId: 'item-tower', targetName: '青铜小塔', relationType: '持有者' },
        { targetId: 'unknown-entity', targetName: '虚无', relationType: '未入库' },
      ],
      summary: '废脉觉醒吞天神体的主角',
      createdAt: 1000,
      updatedAt: 1000,
    },
    {
      id: 'char-xiao',
      projectId: 'p1',
      name: '萧景行',
      aliases: ['内门大师兄'],
      category: 'character',
      attributes: { realm: '聚灵三重' },
      relations: [{ targetId: 'char-chen', targetName: '陈渊', relationType: '宿敌' }],
      summary: '青岚宗内门天才，心胸狭隘',
      createdAt: 1000,
      updatedAt: 1000,
    },
    {
      id: 'item-tower',
      projectId: 'p1',
      name: '青铜小塔',
      aliases: ['混沌古塔'],
      category: 'item',
      attributes: { grade: '天阶' },
      relations: [{ targetId: 'char-chen', targetName: '陈渊', relationType: '当前持有' }],
      summary: '上古神器，内蕴混沌空间',
      createdAt: 1000,
      updatedAt: 1000,
    },
    {
      id: 'loc-qinglan',
      projectId: 'p1',
      name: '青岚宗',
      aliases: [],
      category: 'faction',
      attributes: { level: '二流宗门' },
      relations: [],
      summary: '云州边陲宗门',
      createdAt: 1000,
      updatedAt: 1000,
    },
    {
      id: 'empty-entity',
      projectId: 'p1',
      name: '无名之物',
      category: 'term',
      attributes: {},
      relations: [],
      createdAt: 1000,
      updatedAt: 1000,
    },
  ]

  it('should get individual entities and all entities', () => {
    const store = new CodexGraphStore()
    store.updateDataset(sampleEntities)

    expect(store.getEntity('char-chen')?.name).toBe('陈渊')
    expect(store.getEntity('non-existent')).toBeUndefined()
    expect(store.getAllEntities()).toHaveLength(5)
  })

  it('should return empty slice when no entities are matched', () => {
    const store = new CodexGraphStore()
    store.updateDataset(sampleEntities)

    const slice = store.resolveContextSlice('今天天气很晴朗，万里无云。')
    expect(slice.matchedEntities).toEqual([])
    expect(slice.xmlContext).toBe('')
    expect(slice.totalEstimatedTokens).toBe(0)
  })

  it('should match direct entity and activate 1-hop related entities via Spreading Activation', () => {
    const store = new CodexGraphStore()
    store.updateDataset(sampleEntities)

    // 正文只提到了 "陈渊"
    const text = '陈渊盘膝而坐，运转体内的混沌气流。'
    const slice = store.resolveContextSlice(text, 500)

    // 陈渊直接命中，青铜小塔和萧景行作为 1-hop 关联实体被能量扩散激活
    expect(slice.matchedEntities.length).toBeGreaterThanOrEqual(1)
    expect(slice.matchedEntities[0].id).toBe('char-chen')
    expect(slice.xmlContext).toContain('<living_codex_context>')
    expect(slice.xmlContext).toContain('[CHARACTER] 陈渊')
    expect(slice.xmlContext).toContain('宿敌->萧景行')
  })

  it('should strictly respect tokenBudget and truncate excessive entities', () => {
    const store = new CodexGraphStore()
    store.updateDataset(sampleEntities)

    // 设置很小的 Token 预算 (如 40 tokens)
    const text = '陈渊与萧景行在青岚宗演武场对峙。'
    const slice = store.resolveContextSlice(text, 45)

    expect(slice.matchedEntities.length).toBeGreaterThanOrEqual(1)
    expect(slice.totalEstimatedTokens).toBeLessThanOrEqual(45)
  })

  it('should format entity without summary or relations correctly', () => {
    const store = new CodexGraphStore()
    store.updateDataset(sampleEntities)

    const slice = store.resolveContextSlice('无名之物现世', 500)
    expect(slice.matchedEntities).toHaveLength(1)
    expect(slice.xmlContext).toContain('无名之物: 暂无描述')
  })

  it('should maximize total activation value using 0-1 Knapsack DP rather than naive greedy', () => {
    // 构造经典 0-1 背包反例：
    // Item 1: cost 20, value 11 (单位价值 0.55) -> 贪心会优先选 Item 1，若容量 30，则只能选 Item 1 (总价值 11)
    // Item 2: cost 15, value 10 (单位价值 0.66)
    // Item 3: cost 15, value 10 (单位价值 0.66)
    // DP 在容量 30 时会选 Item 2 + Item 3 (总价值 20 > 11)
    const store = new CodexGraphStore()
    const knapsackEntities: CodexEntity[] = [
      {
        id: 'greedy-trap',
        projectId: 'p1',
        name: '贪心陷阱实体',
        category: 'term',
        attributes: {},
        relations: [],
        summary: '一段较长的描述使该实体的 Token 代价较大以构建背包测试',
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        id: 'optimal-a',
        projectId: 'p1',
        name: '优选实体甲',
        category: 'term',
        attributes: {},
        relations: [],
        summary: '简短描述A',
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        id: 'optimal-b',
        projectId: 'p1',
        name: '优选实体乙',
        category: 'term',
        attributes: {},
        relations: [],
        summary: '简短描述B',
        createdAt: 1000,
        updatedAt: 1000,
      },
    ]
    store.updateDataset(knapsackEntities)

    // 计算三个候选各自的 cost
    // greedy-trap: 命中 keyword 长度 6 -> weight = max(1.0, 6*0.4) = 2.4
    // optimal-a: 命中 keyword 长度 5 -> weight = max(1.0, 5*0.4) = 2.0
    // optimal-b: 命中 keyword 长度 5 -> weight = max(1.0, 5*0.4) = 2.0
    // 输入文本同时包含三者：
    const text = '贪心陷阱实体 优选实体甲 优选实体乙'
    
    // 我们找到一个 tokenBudget 恰好容纳 optimal-a + optimal-b，但容纳不下 greedy-trap + 任意一个
    // 查询各自 cost：
    // baseTagTokens = 20
    // optimal-a line: "[TERM] 优选实体甲: 简短描述A" (长度 17) -> Math.ceil(17 * 0.7) + 4 = 12 + 4 = 16 tokens
    // optimal-b line: "[TERM] 优选实体乙: 简短描述B" (长度 17) -> 16 tokens
    // optimal-a + optimal-b cost = 32 tokens
    // greedy-trap line: "[TERM] 贪心陷阱实体: 一段较长的描述使该实体的 Token 代价较大以构建背包测试" (长度 43) -> Math.ceil(43 * 0.7) + 4 = 31 + 4 = 35 tokens
    // greedy-trap 单独分数 2.4 (若按最高分数降序贪心，greedy-trap 分数 2.4 高于 2.0，贪心先选 greedy-trap，消耗 35 tokens，剩下 budget 不够选其他，总分 2.4)
    // 若 tokenBudget = 20 (base) + 33 = 53
    // greedy-trap: line len 45 -> tokens 36. score = 2.4.
    // optimal-a: line len 19 -> tokens 18. score = 2.0.
    // optimal-b: line len 19 -> tokens 18. score = 2.0.
    // optimal-a + optimal-b cost = 36 tokens, total value = 4.0.
    // 若 availableBudget = 36 (即 tokenBudget = 20 + 36 = 56)：
    // 贪心策略：按分数降序先选 greedy-trap (score 2.4, cost 36)，占满 36 tokens，无法再选其他，贪心总价值 2.4；
    // 0-1 背包 DP：选择 optimal-a (cost 18) + optimal-b (cost 18) = cost 36，总价值 2.0 + 2.0 = 4.0 > 2.4！
    const slice = store.resolveContextSlice(text, 20 + 36)

    expect(slice.matchedEntities.map((e) => e.id).sort()).toEqual(['optimal-a', 'optimal-b'])
    expect(slice.totalEstimatedTokens).toBeLessThanOrEqual(56)
  })
})
