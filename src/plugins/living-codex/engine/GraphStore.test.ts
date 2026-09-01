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
})
