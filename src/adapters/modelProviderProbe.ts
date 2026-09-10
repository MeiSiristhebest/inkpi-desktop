export interface ModelProviderProbeOptions {
  fetchImpl?: typeof fetch
  now?: () => number
  signal?: AbortSignal
  timeoutMs?: number
}

export interface ModelEndpointProbe {
  status: number
  latency: number
}

export async function probeModelEndpoint(
  baseUrl: string,
  apiKey: string | undefined,
  options: ModelProviderProbeOptions = {},
): Promise<ModelEndpointProbe> {
  const fetchImpl = options.fetchImpl ?? fetch
  const now = options.now ?? Date.now
  const start = now()
  const response = await fetchImpl(modelEndpoint(baseUrl), {
    method: 'GET',
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    signal: options.signal ?? AbortSignal.timeout(options.timeoutMs ?? 6000),
  })
  return { status: response.status, latency: Math.max(0, now() - start) }
}

export async function fetchModelIds(
  baseUrl: string,
  apiKey: string | undefined,
  options: ModelProviderProbeOptions = {},
): Promise<string[]> {
  const fetchImpl = options.fetchImpl ?? fetch
  const cleanUrl = normalizeBaseUrl(baseUrl)
  const candidates = cleanUrl.endsWith('/v1')
    ? [`${cleanUrl}/models`, cleanUrl]
    : [`${cleanUrl}/models`, `${cleanUrl}/v1/models`, cleanUrl]
  for (const endpoint of candidates) {
    try {
      const response = await fetchImpl(endpoint, {
        method: 'GET',
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        signal: options.signal ?? AbortSignal.timeout(options.timeoutMs ?? 6000),
      })
      if (!response.ok) continue
      const data: unknown = await response.json()
      const ids = extractModelIds(data)
      if (ids.length > 0) return ids
    } catch {
      // Try the next compatible endpoint.
    }
  }
  return []
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
}

function modelEndpoint(baseUrl: string): string {
  const cleanUrl = normalizeBaseUrl(baseUrl)
  return cleanUrl.endsWith('/v1') ? `${cleanUrl}/models` : `${cleanUrl}/v1/models`
}

function extractModelIds(data: unknown): string[] {
  const record = asRecord(data)
  const models = Array.isArray(record?.data) ? record.data : Array.isArray(record?.models) ? record.models : []
  return models
    .map((model) => {
      const item = asRecord(model)
      const id = item?.id ?? item?.name ?? item?.model
      return typeof id === 'string' ? id : undefined
    })
    .filter((id): id is string => Boolean(id))
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}
