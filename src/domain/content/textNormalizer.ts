/**
 * Normalization used by the Canonical Content Representation.
 *
 * It normalizes transport-level line endings and HTML entities while retaining
 * meaningful whitespace. Paragraph boundaries are represented by the caller;
 * this module never collapses empty paragraphs.
 */

const NUMERIC_ENTITY = /^#(?:x([\da-f]+)|(\d+))$/i

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  laquo: '«',
  ldquo: '“',
  lt: '<',
  mdash: '—',
  nbsp: ' ',
  ndash: '–',
  quot: '"',
  raquo: '»',
  rdquo: '”',
  hellip: '…',
}

export function normalizeText(value: string): string {
  return value.replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ')
}

export function decodeHtmlEntities(value: string): string {
  return value.replace(/&([^;\s]+);/g, (entity, name: string) => {
    const named = NAMED_ENTITIES[name.toLowerCase()]
    if (named !== undefined) return named

    const numeric = name.match(NUMERIC_ENTITY)
    if (!numeric) return entity
    const codePoint = numeric[1] ? Number.parseInt(numeric[1], 16) : Number.parseInt(numeric[2], 10)
    if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return entity
    return String.fromCodePoint(codePoint)
  })
}

export function normalizeHtmlText(value: string): string {
  return normalizeText(decodeHtmlEntities(value))
}
