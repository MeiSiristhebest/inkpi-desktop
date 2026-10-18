import { describe, it, expect } from 'vitest'
import { sceneBeatsEngine as engine } from './SceneBeatsEngine'
describe('Scene budget and author annotations', () => {
  it('maps cumulative budgets to actual count intervals', () => {
    const beats = [0.2, 0.5, 0.3].map((ratio, order) => ({
      id: 'b' + order,
      chapterId: 'c',
      order,
      beatType: 'goal' as const,
      title: '',
      goalOrConflict: '',
      budgetWordRatio: ratio,
      isCompleted: false,
    }))
    const plan = {
      id: 'p',
      projectId: 'book',
      chapterId: 'c',
      targetWordCount: 3000,
      beats,
      createdAt: 0,
      updatedAt: 0,
    }
    expect(engine.calculatePacingStatus(plan, 300)).toMatchObject({
      activeBeatIndex: 0,
      progressPct: 10,
    })
    expect(engine.calculatePacingStatus(plan, 1200)).toMatchObject({
      activeBeatIndex: 1,
      progressPct: 40,
    })
    expect(engine.calculatePacingStatus(plan, 2500).activeBeatIndex).toBe(2)
    expect(engine.calculatePacingStatus(plan, 3100).activeBeatIndex).toBe(-1)
  })
  it('reports authored changes and discontinuities without quality ratings', () => {
    const beats = engine
      .generatePresetPlan('transition', 'c')
      .slice(0, 2)
      .map((b, i) => ({
        ...b,
        emotionalIn: i === 0 ? 0.1 : -0.2,
        emotionalOut: i === 0 ? 0.15 : 0.2,
      }))
    const result = engine.evaluateDramaticArc(beats)
    expect(result.totalAnnotationChange).toBeCloseTo(0.45)
    expect(result.curve).toEqual([0.1, 0.15, -0.2, 0.2])
    expect(result.discontinuities).toHaveLength(1)
    expect(result).not.toHaveProperty('isStagnant')
  })
  it('creates only unfilled planning slots, with valid shares', () => {
    for (const template of ['climax_burst', 'investigation', 'transition'] as const) {
      const beats = engine.generatePresetPlan(template, 'c')
      expect(
        beats.every(
          (b) =>
            b.goalOrConflict === '' && b.emotionalIn === undefined && b.emotionalOut === undefined,
        ),
      ).toBe(true)
      expect(beats.reduce((sum, b) => sum + b.budgetWordRatio, 0)).toBeCloseTo(1)
    }
  })
})
