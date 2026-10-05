export type PluginSafeValue =
  null | boolean | number | string | PluginSafeValue[] | { [key: string]: PluginSafeValue }

export function redactPluginRecord(
  value: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!value) return undefined
  return redactPluginValue(value) as Record<string, unknown>
}

export function redactPluginValue(value: unknown, key?: string): PluginSafeValue {
  if (key && isSensitiveKey(key)) return '[redacted]'
  if (value === undefined) return null
  if (typeof value === 'string') return redactSensitiveString(value)
  if (value === null || typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value)
  if (Array.isArray(value)) return value.map((item) => redactPluginValue(item))
  if (value && typeof value === 'object') {
    const output: { [key: string]: PluginSafeValue } = {}
    for (const [childKey, child] of Object.entries(value)) {
      output[childKey] = redactPluginValue(child, childKey)
    }
    return output
  }
  return String(value)
}

export function redactSensitiveString(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(
      /((?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|credential|private|password|authorization)\s*["']?\s*[:=]\s*["']?)[^\s,;"'}]+/gi,
      '$1[redacted]',
    )
}

export function isSensitiveKey(key: string): boolean {
  return /api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|credential|private|password|authorization|trace/i.test(
    key,
  )
}
