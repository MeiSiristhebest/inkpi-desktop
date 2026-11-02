import { describe, expect, it } from 'vitest'
import { prepareReferenceMaterials, type ReferenceSourceRecord } from './referenceMaterials'

const source = (overrides: Partial<ReferenceSourceRecord> = {}): ReferenceSourceRecord => ({
  id: 'source-city',
  title: '城市交通资料',
  originalFileName: 'city.md',
  format: 'md',
  text: '北京地铁线路持续延伸，城市通勤半径不断扩大。\n\n公共交通与社区更新改变居民生活。',
  tags: ['都市'],
  contentFingerprint: 'test-fingerprint',
  importedAt: 1,
  updatedAt: 1,
  ...overrides,
})

describe('prepareReferenceMaterials', () => {
  it('retrieves excerpts only from explicitly selected sources and discloses unselected links', () => {
    const city = source()
    const fantasy = source({
      id: 'source-fantasy',
      title: '玄幻设定参考',
      text: '北京地铁在这个世界并不存在；灵脉沿着山脉流动。',
      tags: ['玄幻'],
    })

    const prepared = prepareReferenceMaterials([city, fantasy], [city.id], '北京地铁通勤', 400)

    expect(prepared.excerpts).toHaveLength(1)
    expect(prepared.excerpts[0]).toMatchObject({ sourceId: city.id, sourceTitle: city.title })
    expect(prepared.excerpts[0].text).toContain('北京地铁')
    expect(prepared.excerpts.some((excerpt) => excerpt.sourceId === fantasy.id)).toBe(false)
    expect(prepared.disclosure).toMatchObject({
      sourceCount: 2,
      selectedCount: 1,
      includedCount: 1,
      omittedCount: 1,
    })
    expect(prepared.disclosure.sources).toEqual([
      expect.objectContaining({ sourceId: city.id, selected: true, includedPassages: 1 }),
      expect.objectContaining({
        sourceId: fantasy.id,
        selected: false,
        omissionReason: 'not-selected',
      }),
    ])
  })

  it('reports selected sources with no matching passages', () => {
    const item = source({ text: '灵脉汇聚于苍梧山，修士在此开宗立派。' })

    const prepared = prepareReferenceMaterials([item], [item.id], '北京地铁', 500)

    expect(prepared.excerpts).toEqual([])
    expect(prepared.disclosure.sources[0]).toMatchObject({
      selected: true,
      matchedPassages: 0,
      includedPassages: 0,
      omissionReason: 'no-matching-passages',
    })
  })

  it('reports passages omitted by the context budget and keeps excerpts within the limit', () => {
    const first = source({ text: '北京地铁站与通勤生活。' })
    const second = source({
      id: 'source-second',
      title: '另一份都市资料',
      text: '北京地铁线路连接新城与旧区。',
    })

    const prepared = prepareReferenceMaterials(
      [first, second],
      [first.id, second.id],
      '北京地铁',
      10,
    )

    expect(prepared.disclosure.includedCharacters).toBeLessThanOrEqual(10)
    expect(prepared.disclosure.sources[0]).toMatchObject({
      includedPassages: 1,
      omissionReason: 'context-budget',
    })
    expect(prepared.disclosure.sources[1]).toMatchObject({
      matchedPassages: 1,
      includedPassages: 0,
      omissionReason: 'context-budget',
    })
  })
})
