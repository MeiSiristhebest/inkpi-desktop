import { describe, it, expect } from 'vitest'
import { DescribePaletteEngine } from './DescribePaletteEngine'
import type { RandomSource } from '../../../ports/randomSource'

describe('DescribePaletteEngine — 五感微观修辞调色盘引擎', () => {
  const engine = new DescribePaletteEngine()

  it('provides rich default snippets dataset', () => {
    const all = engine.getAllSnippets()
    expect(all.length).toBeGreaterThan(10)
    expect(all.some((s) => s.primarySense === 'sight')).toBe(true)
    expect(all.some((s) => s.primarySense === 'sound')).toBe(true)
    expect(all.some((s) => s.primarySense === 'scent')).toBe(true)
    expect(all.some((s) => s.primarySense === 'touch')).toBe(true)
  })

  it('searches snippets by keyword, genre, and sense', () => {
    const swordResults = engine.searchSnippets('剑芒')
    expect(swordResults.length).toBeGreaterThan(0)
    expect(swordResults[0].text).toContain('剑芒')

    // Filter by sense
    const soundResults = engine.searchSnippets('', { sense: 'sound' })
    expect(soundResults.length).toBeGreaterThan(0)
    expect(soundResults.every((s) => s.primarySense === 'sound')).toBe(true)

    // Filter by genre
    const xianxiaResults = engine.searchSnippets('', { genre: 'xianxia' })
    expect(xianxiaResults.length).toBeGreaterThan(0)
    expect(xianxiaResults.every((s) => s.genre === 'xianxia' || s.genre === 'all')).toBe(true)
  })

  it('diagnoses text and computes sensory radar and advice', () => {
    // 纯视觉描写
    const visualText = '白色的光芒照耀着黑色的阴影，少年眸子明亮，望着远方的青色残霞。'
    const report = engine.diagnoseText(visualText)

    expect(report.totalWordCount).toBeGreaterThan(0)
    expect(report.radar.sight).toBeGreaterThan(0)
    expect(report.dominantSense).toBe('sight')
    expect(report.missingSenses).toContain('scent')
    expect(report.missingSenses).toContain('taste')
    expect(report.advice).toBeTruthy()
    expect(report.suggestedSnippets.length).toBeGreaterThan(0)
  })

  it('handles empty text gracefully in diagnosis', () => {
    const emptyReport = engine.diagnoseText('')
    expect(emptyReport.totalWordCount).toBe(0)
    expect(emptyReport.dominantSense).toBeNull()
    expect(emptyReport.missingSenses.length).toBe(6)
  })

  it('samples random snippets with deterministic RandomSource', () => {
    const mockRng: RandomSource = {
      next: () => 0.0, // always pick index 0
    }
    const sampled = engine.inspireRandom('xianxia', undefined, 2, mockRng)
    expect(sampled.length).toBe(2)
  })
})
