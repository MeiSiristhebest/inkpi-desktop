import { describe, it, expect } from 'vitest'
import { CodexAdapters } from './Adapters'

describe('CodexAdapters Heterogeneous Form Mapping', () => {
  it('should accurately convert character CardRecord into CodexEntity', () => {
    const card = {
      id: 'card-1',
      projectId: 'p1',
      tabId: 'char-main',
      name: '陈渊',
      data: {
        '一、基础信息::别称': '渊哥, 废脉少主',
        '一、基础信息::身份定位': '青岚宗杂役弟子',
        '三、能力与成长::实力境界': '淬体九重',
        '一、基础信息::保密等级': '公开',
        '一、基础信息::人物状态': '活跃',
        '二、性格与内心::核心性格': '坚韧沉稳',
        '五、剧情功能::角色弧光': '逆袭成长',
      },
    }

    const relations = [
      { personA: '陈渊', personB: '萧景行', relType: '宿敌', status: '不共戴天' },
      { personA: '林清寒', personB: '陈渊', relType: '同盟', status: '生死与共' },
    ]

    const entity = CodexAdapters.fromCardRecord(card, relations)

    expect(entity.id).toBe('card-1')
    expect(entity.name).toBe('陈渊')
    expect(entity.aliases).toEqual(['渊哥', '废脉少主'])
    expect(entity.category).toBe('character')
    expect(entity.attributes.realm).toBe('淬体九重')
    expect(entity.attributes.securityLevel).toBe('公开')
    expect(entity.attributes.status).toBe('活跃')
    expect(entity.relations).toHaveLength(2)
    expect(entity.relations[0]).toEqual({
      targetId: '萧景行',
      targetName: '萧景行',
      relationType: '宿敌',
      description: '不共戴天',
    })
    expect(entity.relations[1]).toEqual({
      targetId: '林清寒',
      targetName: '林清寒',
      relationType: '被同盟',
      description: '生死与共',
    })
    expect(entity.summary).toContain('青岚宗杂役弟子')
    expect(entity.summary).toContain('淬体九重')
    expect(entity.summary).toContain('坚韧沉稳')
    expect(entity.summary).toContain('逆袭成长')
    expect(entity.detailMarkdown).toContain('### 一、基础信息::别称')
  })

  it('should handle card record with empty data and fallback values', () => {
    const card = {
      id: 'card-empty',
      projectId: 'p1',
      tabId: 'char-main',
      name: '神秘人',
      data: {},
    }
    const entity = CodexAdapters.fromCardRecord(card, [])
    expect(entity.summary).toBe('神秘人 角色档案')
    expect(entity.aliases).toEqual([])
  })

  it('should accurately convert TableRowRecord across all tab categories', () => {
    // faction (nations)
    const nation = CodexAdapters.fromTableRow({
      id: 'nation-1',
      projectId: 'p1',
      tabId: 'nations',
      data: {
        名称: '青岚宗',
        别称: '青岚剑派',
        类别: '宗门',
        实力等级: '二流',
        '镇派功法/核心武力': '青岚剑诀',
      },
    })
    expect(nation.category).toBe('faction')
    expect(nation.summary).toContain('宗门 · 二流 · 核心:青岚剑诀')

    // location (geography)
    const geo = CodexAdapters.fromTableRow({
      id: 'geo-1',
      projectId: 'p1',
      tabId: 'geography',
      data: {
        名称: '黑风渊',
        类别: '险地',
        危险等级: '极度危险',
        距离与行程时间: '三日路程',
        地理位置: '极北蛮荒',
        上级: '北境',
      },
    })
    expect(geo.category).toBe('location')
    expect(geo.parentId).toBe('北境')
    expect(geo.summary).toContain('险地 · 危险:极度危险 · 行程:三日路程')
    expect(geo.relations[0]).toEqual({
      targetId: '极北蛮荒',
      targetName: '极北蛮荒',
      relationType: '位于',
    })

    // item (items)
    const item = CodexAdapters.fromTableRow({
      id: 'item-1',
      projectId: 'p1',
      tabId: 'items',
      data: {
        名称: '残阳剑',
        类别: '法宝',
        品级: '玄阶上品',
        '能力/效果': '附带灼热真气',
        当前持有者: '陈渊',
        势力归属: '青岚宗',
      },
    })
    expect(item.category).toBe('item')
    expect(item.summary).toContain('法宝 · 品级:玄阶上品 · 效果:附带灼热真气')
    expect(item.relations).toHaveLength(2)

    // race (races)
    const race = CodexAdapters.fromTableRow({
      id: 'race-1',
      projectId: 'p1',
      tabId: 'races',
      data: {
        名称: '古魔族',
        类别: '域外生灵',
        威胁等级: '灭世级',
        能力特性: '魔气侵蚀',
      },
    })
    expect(race.category).toBe('race')
    expect(race.summary).toContain('域外生灵 · 威胁:灭世级 · 特性:魔气侵蚀')

    // history (history)
    const history = CodexAdapters.fromTableRow({
      id: 'hist-1',
      projectId: 'p1',
      tabId: 'history',
      data: {
        事件名称: '玄武之变',
        故事内时间: '太元前五百年',
        '事件经过（真相）': '上古魔神封印破碎',
      },
    })
    expect(history.category).toBe('history')
    expect(history.name).toBe('玄武之变')
    expect(history.summary).toContain('时间:太元前五百年 · 真相:上古魔神封印破碎')

    // terms (terms)
    const term = CodexAdapters.fromTableRow({
      id: 'term-1',
      projectId: 'p1',
      tabId: 'terms',
      data: {
        术语名称: '本命天魔',
        类别: '心境法则',
        '定义（一句话）': '修士破境时心魔所化之执念',
      },
    })
    expect(term.category).toBe('term')
    expect(term.name).toBe('本命天魔')
    expect(term.summary).toContain('心境法则 · 定义:修士破境时心魔所化之执念')

    // unknown tabId fallback (defaults to term category)
    const custom = CodexAdapters.fromTableRow({
      id: 'custom-1',
      projectId: 'p1',
      tabId: 'other',
      data: {
        字段A: '值A',
        字段B: '值B',
      },
    })
    expect(custom.name).toBe('未命名')
    expect(custom.category).toBe('term')
    expect(custom.summary).toBe('术语 · 定义:无')
  })
})
