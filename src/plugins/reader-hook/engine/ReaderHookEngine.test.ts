import { describe, it, expect } from 'vitest'
import { readerHookEngine } from './ReaderHookEngine'

describe('ReaderHookEngine', () => {
  it('returns flat score for empty or tiny tail text', () => {
    const res = readerHookEngine.analyzeEnding('')
    expect(res.tensionScore).toBe(20)
    expect(res.rating).toBe('flat')
  })

  it('detects countdown and scores god_tier', () => {
    const text = '四周阴风呼啸，防护阵法剧烈摇晃。玉简上的倒计时只剩最后三息，生死一线！'
    const res = readerHookEngine.analyzeEnding(text)
    expect(res.tensionScore).toBeGreaterThanOrEqual(85)
    expect(res.hookType).toBe('countdown')
    expect(res.rating).toBe('god_tier')
    expect(res.detectedKeywords).toContain('倒计时')
  })

  it('penalizes flat closure words', () => {
    const text = '这一场恶战终于平息。他洗漱一番，相视一笑，随后闭目养神沉沉睡去。'
    const res = readerHookEngine.analyzeEnding(text)
    expect(res.tensionScore).toBeLessThan(50)
    expect(res.rating).toBe('flat')
    expect(res.feedback).toContain('平淡收场')
  })

  it('detects battle cut with exclamation mark bonus', () => {
    const text = '天雷滚滚，他豁然拔剑，剑芒暴涨百丈，刀光撕裂苍穹！'
    const res = readerHookEngine.analyzeEnding(text)
    expect(res.hookType).toBe('battle_cut')
    expect(res.tensionScore).toBeGreaterThanOrEqual(85)
  })

  it('provides all 6 industrial preset templates', () => {
    const templates = readerHookEngine.getTemplates()
    expect(templates.length).toBe(6)
    const types = templates.map((t) => t.type)
    expect(types).toContain('epiphany')
    expect(types).toContain('countdown')
    expect(types).toContain('battle_cut')
    expect(types).toContain('crisis')
    expect(types).toContain('anomaly')
    expect(types).toContain('question')
  })
})
