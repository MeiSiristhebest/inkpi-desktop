import { describe, it, expect } from 'vitest'
import { sceneBeatsEngine as engine } from './SceneBeatsEngine'
const beat = (id: string, order: number, ratio: number) => ({
  id,
  chapterId: 'c',
  order,
  beatType: 'goal' as const,
  title: id,
  goalOrConflict: '',
  budgetWordRatio: ratio,
  isCompleted: false,
})
const plan = (beats: any[]) => ({
  id: 'p',
  projectId: 'book',
  chapterId: 'c',
  targetWordCount: 10,
  beats,
  createdAt: 0,
  updatedAt: 0,
})
describe('explicit scene budgets', () => {
  it('rejects invalid shares instead of reversing the final interval', () => {
    expect(() =>
      engine.calculatePacingStatus(
        plan([beat('a', 0, 0.8), beat('b', 1, 0.8), beat('c', 2, 0.1)]),
        2,
      ),
    ).toThrow()
    expect(() => engine.calculatePacingStatus(plan([beat('a', 0, 1)]), -1)).toThrow()
  })
  it('keeps rounded boundaries contiguous and does not infer semantic completion', () => {
    const result = engine.calculatePacingStatus(
      plan([beat('a', 0, 1 / 3), beat('b', 1, 1 / 3), beat('c', 2, 1 / 3)]),
      10,
    )
    expect(result.beatProgresses.map((b) => [b.startWord, b.endWord])).toEqual([
      [0, 3],
      [3, 7],
      [7, 10],
    ])
    expect(result.beatProgresses.every((b) => !b.beat.isCompleted)).toBe(true)
    expect(engine.calculatePacingStatus(plan([]), 0).activeBeatIndex).toBe(-1)
  })
  it('treats absent author emotion marks as unknown instead of plot stagnation', () => {
    const report = engine.evaluateDramaticArc([beat('a', 0, 1)])
    expect(report).not.toHaveProperty('isStagnant')
    expect(report.totalAnnotationChange).toBeNull()
    expect(report.curve).toEqual([null, null])
  })
})
