import { describe, expect, it } from 'vitest'
import { formatProviderPrice, mergeProviderCatalog } from './providerModelCatalog'

describe('provider model catalog snapshots', () => {
  it('keeps the latest available IDs and fills partial provider metadata from the prior snapshot', () => {
    expect(
      mergeProviderCatalog(
        ['model-a', 'model-c', 'model-a'],
        [
          { id: 'model-a', name: 'Model A', contextTokens: 64000 },
          { id: 'model-b', name: 'Removed model' },
        ],
        [
          { id: 'model-a', promptPricePerToken: '0.0000001' },
          { id: 'model-c', maxOutputTokens: 4096 },
        ],
      ),
    ).toEqual([
      { id: 'model-a', name: 'Model A', contextTokens: 64000, promptPricePerToken: '0.0000001' },
      { id: 'model-c', maxOutputTokens: 4096 },
    ])
  })

  it('formats exact provider token prices for display without changing their stored form', () => {
    expect(formatProviderPrice('输入', '0.00000015')).toBe('输入 $0.15/1M')
    expect(formatProviderPrice('输出', 'invalid')).toBeUndefined()
  })
})
