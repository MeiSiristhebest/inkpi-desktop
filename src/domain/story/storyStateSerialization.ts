import { assertStoryState, type StoryState } from './storyState'

/**
 * JSON wire boundary for StoryState.
 *
 * IndexedDB keeps the authoritative object, while RPC and projection sync
 * exchange this deterministic JSON representation.  Validation happens both
 * before encoding and after decoding so a derived process cannot accept an
 * untrusted or structurally incompatible story state.
 */
export function serializeStoryState(state: StoryState): string {
  assertStoryState(state)
  assertJsonValue(state, '$')
  return stableStringify(state)
}

export function deserializeStoryState(payload: string): StoryState {
  if (typeof payload !== 'string' || payload.trim().length === 0) {
    throw new TypeError('StoryState payload must be a non-empty JSON string')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(payload)
  } catch (cause) {
    throw new Error('StoryState payload is not valid JSON', { cause })
  }

  assertJsonValue(parsed, '$')
  assertStoryState(parsed as StoryState)
  return structuredClone(parsed as StoryState)
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`

  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .sort()
    .filter((key) => record[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`
}

function assertJsonValue(value: unknown, path: string, ancestors = new Set<object>()): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return
    throw new TypeError(`StoryState contains a non-finite number at ${path}`)
  }
  if (typeof value !== 'object') {
    throw new TypeError(`StoryState contains a non-JSON value at ${path}`)
  }
  if (Array.isArray(value)) {
    if (ancestors.has(value)) throw new TypeError(`StoryState contains a circular value at ${path}`)
    ancestors.add(value)
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.hasOwn(value, index)) {
        throw new TypeError(`StoryState contains a sparse array at ${path}`)
      }
      assertJsonValue(value[index], `${path}[${index}]`, ancestors)
    }
    ancestors.delete(value)
    return
  }
  if (!isPlainRecord(value)) {
    throw new TypeError(`StoryState contains a non-JSON value at ${path}`)
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new TypeError(`StoryState contains a symbol key at ${path}`)
  }
  if (ancestors.has(value)) throw new TypeError(`StoryState contains a circular value at ${path}`)
  ancestors.add(value)
  for (const [key, nested] of Object.entries(value)) {
    if (nested === undefined) continue
    assertJsonValue(nested, `${path}.${key}`, ancestors)
  }
  ancestors.delete(value)
}

function isPlainRecord(value: object): value is Record<string, unknown> {
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}
