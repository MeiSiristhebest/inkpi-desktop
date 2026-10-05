import { describe, it, expect } from 'vitest'
import { MemoryPalaceEngine, MemoryPalaceWorkspaceIndex } from './MemoryPalaceEngine'
import type { CodexEntity } from '../../living-codex/types'
import type { ChapterRecord } from '../../../types'

describe('MemoryPalaceEngine', () => {
  const fakeEntities: CodexEntity[] = [
    {
      id: 'e1',
      projectId: 'p1',
      name: '九霄神雷剑',
      category: 'item',
      aliases: ['神雷剑', '青霄残刃'],
      summary: '上古神兵，雷劫炼化。',
      createdAt: 1000,
      updatedAt: 1000,
    },
    {
      id: 'e2',
      projectId: 'p1',
      name: '柳清霜',
      category: 'character',
      aliases: ['清霜仙子'],
      summary: '缥缈宫圣女。',
      createdAt: 1000,
      updatedAt: 1000,
    },
  ]

  const fakeChapters: ChapterRecord[] = [
    {
      id: 'c1',
      projectId: 'p1',
      volumeId: 'v1',
      title: '踏入秘境',
      order: 1,
      content: '陆沉在山洞中捡到了一柄断剑，正是九霄神雷剑的残片。',
      wordCount: 100,
      createdAt: 1000,
      updatedAt: 1000,
    },
    {
      id: 'c2',
      projectId: 'p1',
      volumeId: 'v1',
      title: '遭遇伏击',
      order: 2,
      content: '黑衣人冷笑，柳清霜拔剑迎敌。',
      wordCount: 100,
      createdAt: 2000,
      updatedAt: 2000,
    },
    {
      id: 'c3',
      projectId: 'p1',
      volumeId: 'v1',
      title: '雷劫降临',
      order: 3,
      content: '天空乌云密布，神雷剑骤然震颤，柳清霜面露忧色。',
      wordCount: 100,
      createdAt: 3000,
      updatedAt: 3000,
    },
  ]

  it('keeps incremental chapter indexing isolated to its workspace', () => {
    const index = new MemoryPalaceWorkspaceIndex('p1')
    index.updateMany(fakeChapters)
    index.update({ ...fakeChapters[0], content: '九霄神雷剑再次现身。' })
    index.update({ ...fakeChapters[0], projectId: 'p2', content: '九霄神雷剑不应进入 p1。' })

    expect(index.size).toBe(3)
    expect(
      index.search('神雷剑', fakeEntities).find((result) => result.entityId === 'e1')
        ?.totalOccurrences,
    ).toBe(2)

    index.remove('c2')
    expect(index.size).toBe(2)
  })

  it('searches entity occurrences across chapters accurately', () => {
    const results = MemoryPalaceEngine.searchEntityOccurrences({
      query: '神雷剑',
      entities: fakeEntities,
      chapters: fakeChapters,
    })

    expect(results.length).toBeGreaterThanOrEqual(1)
    const swordResult = results.find((r) => r.entityId === 'e1')
    expect(swordResult).toBeDefined()
    expect(swordResult?.totalOccurrences).toBe(2) // in c1 and c3
    expect(swordResult?.firstAppearedChapter?.order).toBe(1)
    expect(swordResult?.lastAppearedChapter?.order).toBe(3)
    expect(swordResult?.recentSnippets.length).toBe(2)
  })

  it('detects entities in a given text fragment', () => {
    const detected = MemoryPalaceEngine.detectEntitiesInText(
      '清霜仙子御风而立，望着天际出神。',
      fakeEntities,
    )
    expect(detected.length).toBe(1)
    expect(detected[0].name).toBe('柳清霜')
  })

  it('searches semantic text when chapters are stored as editor HTML', () => {
    const results = MemoryPalaceEngine.searchEntityOccurrences({
      query: '神雷剑',
      entities: fakeEntities,
      chapters: [
        {
          ...fakeChapters[0],
          content: '<h2>秘境</h2><p>正是九霄神雷剑的残片。</p>',
        },
      ],
    })

    expect(results.find((result) => result.entityId === 'e1')?.recentSnippets).toEqual([
      '[第1章 踏入秘境] 秘境 正是九霄神雷剑的残片。',
    ])
  })
})
