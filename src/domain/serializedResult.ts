/** Compare deterministic projection results across JSON serialization of optional fields. */
export function matchesSerializedResult(actual: unknown, expected: unknown): boolean {
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical)
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value)
          .filter(([, child]) => child !== undefined && child !== null)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, child]) => [key, canonical(child)]),
      )
    return value ?? null
  }
  return JSON.stringify(canonical(actual)) === JSON.stringify(canonical(expected))
}
