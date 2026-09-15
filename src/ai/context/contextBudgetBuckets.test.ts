import { describe, it, expect } from 'vitest'
import { calculateContextBudgetBuckets } from './contextBudgetBuckets'

describe('calculateContextBudgetBuckets (P1.7)', () => {
  it('allocates reserved buckets accurately according to predefined proportions', () => {
    const buckets = calculateContextBudgetBuckets(4000)

    expect(buckets.instructionsTokens).toBe(800) // 20%
    expect(buckets.sceneTokens).toBe(1600) // 40%
    expect(buckets.canonicalStoryTokens).toBe(800) // 20%
    expect(buckets.retrievedMemoryTokens).toBe(600) // 15%
    expect(buckets.workingStateTokens).toBe(200) // 5%

    const sum =
      buckets.instructionsTokens +
      buckets.sceneTokens +
      buckets.canonicalStoryTokens +
      buckets.retrievedMemoryTokens +
      buckets.workingStateTokens

    expect(sum).toBe(4000)
  })

  it('guarantees minimum floor for low token budgets', () => {
    const buckets = calculateContextBudgetBuckets(200)
    expect(buckets.instructionsTokens).toBe(100) // 20% of 500
    expect(buckets.sceneTokens).toBe(200) // 40% of 500
  })
})
