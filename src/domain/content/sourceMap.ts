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
  return Math.min(Math.max(value, min), max)
}

function findSemanticSegment(
  segments: readonly SourceMapSegment[],
  position: number,
): SourceMapSegment | undefined {
  return segments.find(
    (segment) => position >= segment.semanticFrom && position <= segment.semanticTo,
  )
}

function findEditorSegment(
  segments: readonly SourceMapSegment[],
  position: number,
): SourceMapSegment | undefined {
  return segments.find((segment) => position >= segment.editorFrom && position <= segment.editorTo)
}

export function createTextSourceMap(
  segments: readonly SourceMapSegment[],
  semanticLength: number,
): TextSourceMap {
  const orderedSegments = [...segments].sort((a, b) => a.semanticFrom - b.semanticFrom)
  const maxEditorPosition = orderedSegments.reduce(
    (max, segment) => Math.max(max, segment.editorTo),
    0,
  )

  const semanticToEditor = (position: number): EditorPosition => {
    const safePosition = clamp(position, 0, semanticLength)
    const segment = findSemanticSegment(orderedSegments, safePosition) ?? orderedSegments.at(-1)
    if (!segment) return { from: 0, to: 0 }

    const semanticSpan = segment.semanticTo - segment.semanticFrom
    const editorSpan = segment.editorTo - segment.editorFrom
    const offset = safePosition - segment.semanticFrom
    const mappedOffset = semanticSpan === 0 ? 0 : Math.round((offset / semanticSpan) * editorSpan)
    const editorPosition = clamp(
      segment.editorFrom + mappedOffset,
      segment.editorFrom,
      segment.editorTo,
    )
    return { from: editorPosition, to: editorPosition, blockId: segment.blockId }
  }

  const editorToSemantic = (position: EditorPosition): number => {
    const safePosition = clamp(position.from, 0, maxEditorPosition)
    const segment = findEditorSegment(orderedSegments, safePosition) ?? orderedSegments.at(-1)
    if (!segment) return 0

    const editorSpan = segment.editorTo - segment.editorFrom
    const semanticSpan = segment.semanticTo - segment.semanticFrom
    const offset = safePosition - segment.editorFrom
    const mappedOffset = editorSpan === 0 ? 0 : Math.round((offset / editorSpan) * semanticSpan)
    return clamp(segment.semanticFrom + mappedOffset, segment.semanticFrom, segment.semanticTo)
  }

  return {
    semanticToEditor,
    editorToSemantic,
    semanticRangeToEditor(from, to) {
      const start = semanticToEditor(from)
      const end = semanticToEditor(to)
      return { from: start.from, to: end.to, blockId: start.blockId }
    },
    editorRangeToSemantic(position) {
      return {
        from: editorToSemantic(position),
        to: editorToSemantic({ from: position.to, to: position.to }),
      }
    },
    segments: orderedSegments,
  }
}
