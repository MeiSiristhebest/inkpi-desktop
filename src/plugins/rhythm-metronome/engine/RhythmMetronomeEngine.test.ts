import { describe, it, expect } from 'vitest'
import { RhythmMetronomeEngine } from './RhythmMetronomeEngine'

describe('RhythmMetronomeEngine', () => {
  it('calculates 3-tier cycle beats accurately', () => {
    // 第 3 章：微循环终结（第3步），中循环第3步，大循环第3步
    const beatsCh3 = RhythmMetronomeEngine.calculateBeats(3)
    expect(beatsCh3.micro.currentStep).toBe(3)
    expect(beatsCh3.micro.phase).toBe('breather_reward')
    expect(beatsCh3.meso.currentStep).toBe(3)
    expect(beatsCh3.macro.currentStep).toBe(3)

    // 第 15 章：中循环终结（第15步）
    const beatsCh15 = RhythmMetronomeEngine.calculateBeats(15)
    expect(beatsCh15.meso.currentStep).toBe(15)
    expect(beatsCh15.meso.phase).toBe('breather_reward')

    // 第 50 章：宏观卷末大循环终结（第50步）
    const beatsCh50 = RhythmMetronomeEngine.calculateBeats(50)
    expect(beatsCh50.macro.currentStep).toBe(50)
    expect(beatsCh50.macro.phase).toBe('breather_reward')
  })

  it('diagnoses stagnation accurately when stagnant chapters accumulate', () => {
    const reportHealthy = RhythmMetronomeEngine.diagnoseStagnation(0, [2500, 2600, 2400])
    expect(reportHealthy.isStagnant).toBe(false)
    expect(reportHealthy.pacingPacingScore).toBeGreaterThanOrEqual(80)

    const reportSevere = RhythmMetronomeEngine.diagnoseStagnation(3, [2200, 2000, 1800])
    expect(reportSevere.isStagnant).toBe(true)
    expect(reportSevere.stagnantChapters).toBe(3)
    expect(reportSevere.pacingPacingScore).toBeLessThan(50)
    expect(reportSevere.diagnostic).toContain('严重警报')
  })
})
