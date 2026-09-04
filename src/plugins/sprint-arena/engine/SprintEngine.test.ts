import { describe, it, expect } from 'vitest'
import { SprintEngine } from './SprintEngine'

describe('SprintEngine — 心流极速码字冲刺引擎', () => {
  const engine = new SprintEngine()

  it('calculates WPM accurately', () => {
    // 10 秒打 20 个字 => 120 WPM
    expect(engine.calculateWpm(20, 10)).toBe(120)
    expect(engine.calculateWpm(0, 10)).toBe(0)
    expect(engine.calculateWpm(10, 0)).toBe(0)
  })

  it('smooths WPM using exponential moving average', () => {
    const prev = 60
    const instant = 100
    const smoothed = engine.smoothWpm(prev, instant, 0.3)
    // 0.3 * 100 + 0.7 * 60 = 30 + 42 = 72
    expect(smoothed).toBe(72)
  })

  it('determines flow levels properly based on combo and WPM', () => {
    expect(engine.determineFlowLevel(0, 0)).toBe('idle')
    expect(engine.determineFlowLevel(5, 20)).toBe('warm_up')
    expect(engine.determineFlowLevel(15, 40)).toBe('focused')
    expect(engine.determineFlowLevel(35, 65)).toBe('flow_surge')
    expect(engine.determineFlowLevel(70, 85)).toBe('zen_mode')
  })

  it('sustains combo within time window and breaks when idle', () => {
    const t0 = 10000
    expect(engine.isComboSustained(t0 + 2000, t0, 3500)).toBe(true)
    expect(engine.isComboSustained(t0 + 4000, t0, 3500)).toBe(false)
  })
})
