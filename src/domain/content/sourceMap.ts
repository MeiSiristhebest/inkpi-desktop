export interface EditorPosition {
  from: number
  to: number
  blockId?: string
}

export interface SourceMapSegment {
  blockId: string
  semanticFrom: number
  semanticTo: number
  editorFrom: number
  editorTo: number
}

export interface TextSourceMap {
  semanticToEditor(position: number): EditorPosition
  editorToSemantic(position: EditorPosition): number
  semanticRangeToEditor(from: number, to: number): EditorPosition
  editorRangeToSemantic(position: EditorPosition): EditorPosition
  readonly segments: readonly SourceMapSegment[]
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return value === Number.POSITIVE_INFINITY ? max : min
  return Math.min(Math.max(value, min), max)
}

type BoundaryPreference = 'start' | 'end'

function findSemanticSegment(
  segments: readonly SourceMapSegment[],
  position: number,
  preference: BoundaryPreference,
): SourceMapSegment | undefined {
  const matching = segments.filter(
    (segment) => position >= segment.semanticFrom && position <= segment.semanticTo,
  )
  if (matching.length === 0) return undefined

  if (preference === 'start') {
    return matching.find(
      (segment) => segment.semanticFrom === position && segment.semanticTo > segment.semanticFrom,
    ) ?? matching[0]
  }

  return [...matching].reverse().find(
    (segment) => segment.semanticTo === position && segment.semanticTo > segment.semanticFrom,
  ) ?? matching[matching.length - 1]
}

function findEditorSegment(
  segments: readonly SourceMapSegment[],
  position: number,
  preference: BoundaryPreference,
): SourceMapSegment | undefined {
  const matching = segments.filter(
    (segment) => position >= segment.editorFrom && position <= segment.editorTo,
  )
  if (matching.length === 0) return undefined

  if (preference === 'start') {
    return matching.find(
      (segment) => segment.editorFrom === position && segment.editorTo > segment.editorFrom,
    ) ?? matching[0]
  }

  return [...matching].reverse().find(
    (segment) => segment.editorTo === position && segment.editorTo > segment.editorFrom,
  ) ?? matching[matching.length - 1]
}

function findNearestSemanticSegment(
  segments: readonly SourceMapSegment[],
  position: number,
): SourceMapSegment | undefined {
  const before = [...segments].reverse().find((segment) => segment.semanticTo < position)
  const after = segments.find((segment) => segment.semanticFrom > position)
  if (!before) return after
  if (!after) return before
  return position - before.semanticTo <= after.semanticFrom - position ? before : after
}

function findNearestEditorSegment(
  segments: readonly SourceMapSegment[],
  position: number,
): SourceMapSegment | undefined {
  const before = [...segments].reverse().find((segment) => segment.editorTo < position)
  const after = segments.find((segment) => segment.editorFrom > position)
  if (!before) return after
  if (!after) return before
  return position - before.editorTo <= after.editorFrom - position ? before : after
}

export function createTextSourceMap(
  segments: readonly SourceMapSegment[],
  semanticLength: number,
): TextSourceMap {
  const orderedSegments = [...segments].sort((a, b) => a.semanticFrom - b.semanticFrom)
  const safeSemanticLength = Math.max(0, Number.isFinite(semanticLength) ? semanticLength : 0)
  const maxEditorPosition = orderedSegments.reduce(
    (max, segment) => Math.max(max, segment.editorTo),
    0,
  )

  const mapSemanticPosition = (
    position: number,
    preference: BoundaryPreference,
  ): EditorPosition => {
    const safePosition = clamp(position, 0, safeSemanticLength)
    const segment =
      findSemanticSegment(orderedSegments, safePosition, preference) ??
      findNearestSemanticSegment(orderedSegments, safePosition)
    if (!segment) return { from: 0, to: 0 }

    const semanticSpan = segment.semanticTo - segment.semanticFrom
    const editorSpan = segment.editorTo - segment.editorFrom
    const offset = clamp(safePosition, segment.semanticFrom, segment.semanticTo) - segment.semanticFrom
    const mappedOffset = semanticSpan === 0 ? 0 : Math.round((offset / semanticSpan) * editorSpan)
    const editorPosition = clamp(
      segment.editorFrom + mappedOffset,
      segment.editorFrom,
      segment.editorTo,
    )
    return { from: editorPosition, to: editorPosition, blockId: segment.blockId }
  }

  const mapEditorPosition = (position: number, preference: BoundaryPreference): number => {
    const safePosition = clamp(position, 0, maxEditorPosition)
    const segment =
      findEditorSegment(orderedSegments, safePosition, preference) ??
      findNearestEditorSegment(orderedSegments, safePosition)
    if (!segment) return 0

    const editorSpan = segment.editorTo - segment.editorFrom
    const semanticSpan = segment.semanticTo - segment.semanticFrom
    const offset = clamp(safePosition, segment.editorFrom, segment.editorTo) - segment.editorFrom
    const mappedOffset = editorSpan === 0 ? 0 : Math.round((offset / editorSpan) * semanticSpan)
    return clamp(segment.semanticFrom + mappedOffset, segment.semanticFrom, segment.semanticTo)
  }

  const semanticToEditor = (position: number): EditorPosition =>
    mapSemanticPosition(position, 'start')

  const editorToSemantic = (position: EditorPosition): number =>
    mapEditorPosition(position.from, 'start')

  return {
    semanticToEditor,
    editorToSemantic,
    semanticRangeToEditor(from, to) {
      const startPosition = clamp(Math.min(from, to), 0, safeSemanticLength)
      const endPosition = clamp(Math.max(from, to), 0, safeSemanticLength)
      const start = mapSemanticPosition(startPosition, 'start')
      if (startPosition === endPosition) {
        return { from: start.from, to: start.from, blockId: start.blockId }
      }
      const end = mapSemanticPosition(endPosition, 'end')
      return {
        from: Math.min(start.from, end.from),
        to: Math.max(start.to, end.to),
        blockId: start.blockId,
      }
    },
    editorRangeToSemantic(position) {
      const startPosition = clamp(Math.min(position.from, position.to), 0, maxEditorPosition)
      const endPosition = clamp(Math.max(position.from, position.to), 0, maxEditorPosition)
      const fromValue = mapEditorPosition(startPosition, 'start')
      if (startPosition === endPosition) return { from: fromValue, to: fromValue }
      const toValue = mapEditorPosition(endPosition, 'end')
      return {
        from: Math.min(fromValue, toValue),
        to: Math.max(fromValue, toValue),
      }
    },
    segments: orderedSegments,
  }
}
