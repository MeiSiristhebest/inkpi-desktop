import { describe, it, expect } from 'vitest'
import { RhythmRadarEngine } from './RhythmRadarEngine'

describe('RhythmRadarEngine (剧情节奏与断章雷达)', () => {
  it('对充满战斗词汇的激烈章节准确评估高张力指数', () => {
    const fightText = '林凡拔剑怒斩！雷光轰然爆发，鲜血狂飙，剑气撕碎长空，杀意滔天！'
    const result = RhythmRadarEngine.analyzeChapter(fightText, 'ch1', 1)

    expect(result.tensionScore).toBeGreaterThanOrEqual(0.6)
    expect(result.actionDensity).toBeGreaterThan(0.4)
  })

  it('当章节出现强烈悲喜反差与冲突对立时，基于 Arousal 不会发生抵消归零', () => {
    // 悲喜交加文本：15个正向词 + 15个负向词，极度激烈的情感冲撞
    const conflictText =
      '他狂喜大笑，又痛哭流涕！既胜且败，希望与绝望同时撕裂灵魂，崩塌的废墟中诞生微弱生机，冰冷与温暖交织！'
    const result = RhythmRadarEngine.analyzeChapter(conflictText, 'ch_arousal', 1)

    // 在传统 abs(pos - neg) 算法中 valence 会归零，但基于 Arousal 的复合张力应保持较高水平
    expect(result.tensionScore).toBeGreaterThan(0.4)
  })

  it('当章末揭示秘密时，精准推荐 info_twist (信息反转) 黄金断章切口', () => {
    const twistText = '漫天尘埃落定。那刺客缓缓摘下脸上面具，冷笑一声道：其实我才是当年的真相。'
    const result = RhythmRadarEngine.analyzeChapter(twistText, 'ch2', 2)

    expect(result.cliffhanger.type).toBe('info_twist')
    expect(result.cliffhanger.hookPrompt).toContain('颠覆读者固有认知')
  })
})
