import { describe, expect, it } from 'vitest'
import { SubPlotBraidEngine } from './SubPlotBraidEngine'
import type { SubPlotStrand } from '../types'
const strand = (overrides = {}): SubPlotStrand => ({
  id: 's',
  projectId: 'p',
  title: '',
  summary: '',
  status: 'active',
  involvedCharacterIds: [],
  involvedCharacterNames: [],
  tags: [],
  startChapterOrder: 0,
  lastActiveChapterOrder: 0,
  updatedAt: 0,
  ...overrides,
})
describe('author subplot advancement and prerequisites', () => {
  it('does not infer activity from an empty title or a chapter one fallback', () => {
    expect(
      SubPlotBraidEngine.detectActiveStrandsInText({ text: '正文', strands: [strand()] }),
    ).toEqual([])
    expect(
      SubPlotBraidEngine.assessStrandHealth({ strands: [strand()], currentMaxChapterOrder: 50 })[0]
        .dormancyDistance,
    ).toBeNull()
  })
  it('needs author reminder intervals and convergence requirements', () => {
    const report = SubPlotBraidEngine.assessStrandHealth({
      strands: [
        strand({ startChapterOrder: 1, lastActiveChapterOrder: 2 }),
        strand({ id: 'done', status: 'resolved' }),
      ],
      currentMaxChapterOrder: 50,
    })
    expect(report[0].isStarved).toBe(false)
    expect(report[1].convergenceReadiness).toBe('unknown')
  })
})
