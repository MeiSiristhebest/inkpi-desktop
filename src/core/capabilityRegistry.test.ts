import { describe, it, expect } from 'vitest'
import { getCapability } from './capabilityRegistry'

describe('CAPABILITY_REGISTRY (P2.1, P2.2, INV-10)', () => {
  it('correctly categorizes production vs beta vs experimental capabilities', () => {
    const codex = getCapability('living-codex')
    expect(codex).toBeDefined()
    expect(codex?.maturity).toBe('production')
    expect(codex?.mutatesCanonicalState).toBe(true)
    expect(codex?.mutatesDocument).toBe(false)

    const diffReviewer = getCapability('diff-reviewer')
    expect(diffReviewer?.maturity).toBe('production')
    expect(diffReviewer?.mutatesDocument).toBe(true)

    const waterMeter = getCapability('water-meter')
    expect(waterMeter?.maturity).toBe('experimental')

    const multiverse = getCapability('multiverse-whatif')
    expect(multiverse?.maturity).toBe('demo')
  })

  it('declares capability surfaces properly', () => {
    const sentinel = getCapability('consistency-sentinel')
    expect(sentinel?.surfaces).toContain('inspector')
    expect(sentinel?.surfaces).not.toContain('canvas')
  })
})
