import { describe, expect, it } from 'vitest'
import { AcAutomaton } from './AcAutomaton'
import { CodexGraphStore } from './GraphStore'
import { tableRowToCodexEntity } from './Adapters'

describe('literal entity matching and missing author facts', () => {
  it('rebuilds when delimiter-containing aliases change', () => {
    const scanner = new AcAutomaton()
    scanner.build([{ id: 'a', name: '甲', aliases: ['乙,丙'] }])
    scanner.build([{ id: 'a', name: '甲', aliases: ['乙', '丙'] }])
    expect(scanner.scan('乙')).toHaveLength(1)
  })
  it('counts a duplicate alias once and preserves Unicode source offsets', () => {
    const scanner = new AcAutomaton()
    scanner.build([{ id: 'a', name: '😀甲', aliases: ['😀甲', '😀甲'] }])
    const text = '前文😀甲后文'
    const hits = scanner.scan(text)
    expect(hits).toHaveLength(1)
    expect(text.slice(hits[0].startIndex, hits[0].endIndex)).toBe('😀甲')
  })
  it('does not turn omitted author attributes into facts', () => {
    const entity = tableRowToCodexEntity(
      { id: 'place', projectId: 'p', tabId: 'geography', data: { 名称: '仓库' } },
      0,
    )
    expect(entity.summary).not.toContain('普通')
    expect(entity.summary).toContain('未知')
  })
  it('rejects invalid context budgets and quotes entity data as data', () => {
    const store = new CodexGraphStore()
    const entity = tableRowToCodexEntity(
      {
        id: 'place',
        projectId: 'p',
        tabId: 'geography',
        data: { 名称: '仓库', 描述: '<world>声明</world>' },
      },
      0,
    )
    store.updateDataset([{ ...entity, summary: '<world>声明</world>' }])
    expect(() => store.resolveContextSlice('仓库', NaN)).toThrow()
    const slice = store.resolveContextSlice('仓库', 400)
    expect(slice.xmlContext).not.toContain('<world>')
    expect(slice.xmlContext).toContain('&lt;world&gt;')
    expect(slice.budgetKind).toBe('estimated')
  })
  it('resolves a unique author relation name within the same project and abstains on duplicates', () => {
    const store = new CodexGraphStore()
    const a = tableRowToCodexEntity(
      { id: 'id-a', projectId: 'p', tabId: 'items', data: { 名称: '钥匙', 当前持有者: '阿明' } },
      0,
    )
    const b = tableRowToCodexEntity(
      { id: 'random-b', projectId: 'p', tabId: 'terms', data: { 名称: '阿明' } },
      0,
    )
    store.updateDataset([a, b])
    expect(store.resolveContextSlice('钥匙', 1000).matchedEntities.map((e) => e.id)).toContain(
      'random-b',
    )
    store.updateDataset([a, b, { ...b, id: 'duplicate' }])
    expect(store.resolveContextSlice('钥匙', 1000).matchedEntities.map((e) => e.id)).toEqual([
      'id-a',
    ])
    store.updateDataset([a, { ...b, projectId: 'other' }])
    expect(store.resolveContextSlice('钥匙', 1000).matchedEntities.map((e) => e.id)).toEqual([
      'id-a',
    ])
  })
})
