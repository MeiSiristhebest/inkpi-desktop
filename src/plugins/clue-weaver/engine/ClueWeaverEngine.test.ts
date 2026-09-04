import { describe, it, expect } from 'vitest'
import { clueWeaverEngine } from './ClueWeaverEngine'
import type { ClueItem, ClueCognitionRecord } from '../types'

describe('ClueWeaverEngine', () => {
  const dummyClues: ClueItem[] = [
    {
      id: 'c1',
      projectId: 'p1',
      title: '太上长老非走火入魔乃中毒',
      category: 'murder',
      description: '丹田处有三道黑纹，乃九幽冥毒之相。',
      keywords: ['九幽冥毒', '中毒', '黑纹'],
      status: 'active',
      createdAt: 100,
      updatedAt: 100,
    },
    {
      id: 'c2',
      projectId: 'p1',
      title: '宗主私通魔教',
      category: 'conspiracy',
      description: '密信藏于后山密室暗格。',
      keywords: ['私通魔教', '后山密室', '密信'],
      status: 'active',
      createdAt: 100,
      updatedAt: 100,
    },
  ]

  it('scans text and detects god-view leakage when a character speaks an unknown clue keyword', () => {
    const cognitions: ClueCognitionRecord[] = [
      {
        id: 'cog1',
        projectId: 'p1',
        clueId: 'c1',
        characterId: 'char-lu',
        characterName: '陆沉',
        epistemicState: 'blind', // 陆沉不知道
        updatedAt: 100,
      },
    ]

    const text = '陆沉冷笑道：“师兄，你当真以为太上长老是走火入魔？那分明是中了九幽冥毒！”'
    const violations = clueWeaverEngine.scanGodViewLeakage(text, dummyClues, cognitions)

    expect(violations.length).toBe(1)
    expect(violations[0].characterName).toBe('陆沉')
    expect(violations[0].matchedKeyword).toBe('九幽冥毒')
    expect(violations[0].reason).toContain('未知盲区')
  })

  it('passes when character who speaks has known epistemic state', () => {
    const cognitions: ClueCognitionRecord[] = [
      {
        id: 'cog1',
        projectId: 'p1',
        clueId: 'c1',
        characterId: 'char-lu',
        characterName: '陆沉',
        epistemicState: 'known', // 陆沉已知
        updatedAt: 100,
      },
    ]

    const text = '陆沉冷笑道：“师兄，你当真以为太上长老是走火入魔？那分明是中了九幽冥毒！”'
    const violations = clueWeaverEngine.scanGodViewLeakage(text, dummyClues, cognitions)

    expect(violations.length).toBe(0)
  })

  it('computes information advantage ratio correctly between two characters', () => {
    const cognitions: ClueCognitionRecord[] = [
      {
        id: 'cog1',
        projectId: 'p1',
        clueId: 'c1',
        characterId: 'char-lu',
        characterName: '陆沉',
        epistemicState: 'known',
        updatedAt: 100,
      },
      {
        id: 'cog2',
        projectId: 'p1',
        clueId: 'c2',
        characterId: 'char-lu',
        characterName: '陆沉',
        epistemicState: 'known',
      },
      {
        id: 'cog3',
        projectId: 'p1',
        clueId: 'c1',
        characterId: 'char-lin',
        characterName: '林夕',
        epistemicState: 'known',
      },
    ]

    const adv = clueWeaverEngine.computeAdvantage(
      'char-lu',
      '陆沉',
      'char-lin',
      '林夕',
      dummyClues,
      cognitions
    )

    // 陆沉知道 c1, c2；林夕知道 c1
    // 双方共同知道 c1，陆沉独占 c2
    expect(adv.mutualKnown).toContain('太上长老非走火入魔乃中毒')
    expect(adv.knownByAOnly).toContain('宗主私通魔教')
    expect(adv.knownByBOnly.length).toBe(0)
    expect(adv.advantageScore).toBeGreaterThan(0) // 陆沉具有正向情报优势
  })

  it('generates 2D cognition matrix grid', () => {
    const characters = [
      { id: 'char-lu', name: '陆沉' },
      { id: 'char-lin', name: '林夕' },
    ]
    const cognitions: ClueCognitionRecord[] = [
      {
        id: 'cog1',
        projectId: 'p1',
        clueId: 'c1',
        characterId: 'char-lu',
        characterName: '陆沉',
        epistemicState: 'known',
      },
    ]

    const grid = clueWeaverEngine.getCognitionMatrix(characters, dummyClues, cognitions)
    expect(grid.length).toBe(2)
    expect(grid[0].character.name).toBe('陆沉')
    expect(grid[0].clueStates[0].state).toBe('known')
    expect(grid[1].character.name).toBe('林夕')
    expect(grid[1].clueStates[0].state).toBe('blind')
  })
})
