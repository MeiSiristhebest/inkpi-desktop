import type { AiArtifact } from './artifactStore'

export type ArtifactJsonValue =
  null | boolean | number | string | ArtifactJsonValue[] | { [key: string]: ArtifactJsonValue }

export class ArtifactSerializationError extends Error {
  readonly code = 'ARTIFACT_NOT_SERIALIZABLE'
  readonly path: string

  constructor(path: string, reason: string) {
    super(`Artifact value at ${path} is not JSON serializable: ${reason}`)
    this.name = 'ArtifactSerializationError'
    this.path = path
  }
}

/**
 * Clones an artifact into the JSON-safe shape shared by persistence and export.
 * Undefined object properties follow JSON semantics and are omitted; unsupported
 * values fail before they can cross an IndexedDB or RPC boundary.
 */
export function normalizeArtifactForPersistence(artifact: AiArtifact): AiArtifact {
  return normalizeValue(artifact, '$', new WeakSet()) as unknown as AiArtifact
}

/** Returns canonical JSON with recursively sorted object keys. */
export function serializeArtifactForExport(artifact: AiArtifact): string {
  return stableJsonStringify(
    normalizeArtifactForPersistence(artifact) as unknown as ArtifactJsonValue,
  )
}

function normalizeValue(
  value: unknown,
  path: string,
  seen: WeakSet<object>,
): ArtifactJsonValue | undefined {
  if (value === undefined) return undefined
  if (value === null) return null

  switch (typeof value) {
    case 'string':
    case 'boolean':
      return value
    case 'number':
      if (!Number.isFinite(value)) {
        throw new ArtifactSerializationError(path, 'non-finite number')
      }
      return value
    case 'object':
      break
    default:
      throw new ArtifactSerializationError(path, `unsupported ${typeof value}`)
  }

  if (seen.has(value)) {
    throw new ArtifactSerializationError(path, 'cyclic reference')
  }
  seen.add(value)

  try {
    if (Array.isArray(value)) {
      return value.map((item, index) => {
        const normalized = normalizeValue(item, `${path}[${index}]`, seen)
        return normalized === undefined ? null : normalized
      })
    }

    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      throw new ArtifactSerializationError(path, 'unsupported object type')
    }

    const result: { [key: string]: ArtifactJsonValue } = {}
    for (const key of Object.keys(value).sort()) {
      const normalized = normalizeValue(
        (value as Record<string, unknown>)[key],
        `${path}.${key}`,
        seen,
      )
      if (normalized !== undefined) result[key] = normalized
    }
    return result
  } finally {
    seen.delete(value)
  }
}

function stableJsonStringify(value: ArtifactJsonValue): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJsonStringify(item)).join(',')}]`
  }
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJsonStringify(value[key])}`)
    .join(',')}}`
}
