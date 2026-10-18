import type { RuntimeModelCatalogEntry } from '@inkpi/protocol'

/** Keep provider metadata only for models returned by the latest successful read. */
export function mergeProviderCatalog(
  ids: readonly string[],
  previous: readonly RuntimeModelCatalogEntry[],
  incoming: readonly RuntimeModelCatalogEntry[],
): RuntimeModelCatalogEntry[] {
  const previousById = new Map(previous.map((model) => [model.id, model]))
  const incomingById = new Map(incoming.map((model) => [model.id, model]))
  return [...new Set(ids)].map((id) => ({
    ...previousById.get(id),
    ...incomingById.get(id),
    id,
  }))
}

export function formatProviderPrice(label: string, pricePerToken?: string): string | undefined {
  if (pricePerToken === undefined) return undefined
  const pricePerMillionTokens = Number(pricePerToken) * 1_000_000
  if (!Number.isFinite(pricePerMillionTokens) || pricePerMillionTokens < 0) return undefined
  const formatted = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 4 }).format(
    pricePerMillionTokens,
  )
  return `${label} $${formatted}/1M`
}
