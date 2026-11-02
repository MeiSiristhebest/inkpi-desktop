import { describe, expect, it } from 'vitest'
import { readDesktopPreparedContextCoverage } from './aiContextCoverage'

const coverage = {
  version: 1,
  documentText: { sourceCharacters: 10, includedCharacters: 10, rangeStart: 0, rangeEnd: 10 },
  selectionText: {
    explicitSelection: false,
    sourceCharacters: 10,
    includedCharacters: 10,
    rangeStart: 0,
    rangeEnd: 10,
  },
  semanticBlocks: { count: 1, characters: 10 },
  neighboringDocuments: { count: 0, characters: 0 },
  storyState: { attached: false, recordCount: 0 },
  storyContext: { recordCount: 0, canonicalFactCount: 0, hypothesisCount: 0 },
  jit: { entityCount: 0, promiseCount: 0 },
  referenceMaterials: {
    sourceCount: 2,
    selectedCount: 1,
    includedCount: 1,
    omittedCount: 1,
    includedCharacters: 120,
    sources: [
      {
        sourceId: 'ref-included',
        title: 'City reference',
        selected: true,
        matchedPassages: 1,
        includedPassages: 1,
        includedCharacters: 120,
      },
      {
        sourceId: 'ref-unselected',
        title: 'Fantasy reference',
        selected: false,
        matchedPassages: 0,
        includedPassages: 0,
        includedCharacters: 0,
        omissionReason: 'not-selected',
      },
    ],
  },
}

describe('readDesktopPreparedContextCoverage', () => {
  it('accepts reference-material disclosure without carrying excerpt text', () => {
    const result = readDesktopPreparedContextCoverage(coverage)

    expect(result?.referenceMaterials).toMatchObject({
      sourceCount: 2,
      selectedCount: 1,
      includedCount: 1,
      omittedCount: 1,
      includedCharacters: 120,
    })
    expect(JSON.stringify(result)).not.toContain('reference excerpt body')
  })

  it('rejects inconsistent or content-bearing reference disclosure values', () => {
    expect(
      readDesktopPreparedContextCoverage({
        ...coverage,
        referenceMaterials: { ...coverage.referenceMaterials, includedCharacters: 121 },
      }),
    ).toBeUndefined()
    expect(
      readDesktopPreparedContextCoverage({
        ...coverage,
        referenceMaterials: { ...coverage.referenceMaterials, body: 'reference excerpt body' },
      }),
    ).toMatchObject({ referenceMaterials: coverage.referenceMaterials })
  })
})
