/** Stable identity for a semantic block when the editor node has no id attr. */

function fnv1a(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function createBlockId(
  documentId: string,
  ordinal: number,
  type: string,
  existingId?: unknown,
): string {
  if (typeof existingId === 'string' && existingId.trim()) return existingId.trim()
  return `block-${fnv1a(`${documentId}\u0000${ordinal}\u0000${type}`)}`
}
