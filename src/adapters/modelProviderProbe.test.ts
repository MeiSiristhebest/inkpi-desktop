import { describe, expect, it, vi } from 'vitest'
import { fetchModelIds, probeModelEndpoint } from './modelProviderProbe'

describe('model provider probe adapter', () => {
  it('normalizes the model endpoint and measures latency without exposing fetch to the UI', async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe('https://example.test/v1/models')
      expect(init?.headers).toEqual({ Authorization: 'Bearer secret' })
      return new Response('{}', { status: 200 })
    })
    let tick = 100

    const result = await probeModelEndpoint('https://example.test///', 'secret', {
      fetchImpl,
      now: () => (tick += 25),
      signal: new AbortController().signal,
    })

    expect(result).toEqual({ status: 200, latency: 25 })
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it('tries compatible list endpoints and normalizes OpenAI-compatible model shapes', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'gpt-test' }] }), { status: 200 }))

    await expect(fetchModelIds('https://example.test/', undefined, {
      fetchImpl,
      signal: new AbortController().signal,
    })).resolves.toEqual(['gpt-test'])
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})
