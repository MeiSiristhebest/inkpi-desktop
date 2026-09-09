import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { ContinuityDiagnosticMarker } from '../ai/results/continuityDiagnostics'

export const continuityDiagnosticsPluginKey = new PluginKey<DecorationSet>(
  'inkContinuityDiagnostics',
)

export interface ContinuityDiagnosticsOptions {
  markers: readonly ContinuityDiagnosticMarker[]
}

/** Renders structured continuity findings without changing editor content. */
export const ContinuityDiagnostics = Extension.create<ContinuityDiagnosticsOptions>({
  name: 'inkContinuityDiagnostics',

  addOptions() {
    return { markers: [] }
  },

  addProseMirrorPlugins() {
    const initialMarkers = this.options.markers
    return [
      new Plugin<DecorationSet>({
        key: continuityDiagnosticsPluginKey,
        state: {
          init: (_, { doc }) => buildDecorations(doc, initialMarkers),
          apply: (tr, value, _oldState, newState) => {
            const meta = tr.getMeta(continuityDiagnosticsPluginKey) as
              readonly ContinuityDiagnosticMarker[] | undefined
            if (meta !== undefined) return buildDecorations(newState.doc, meta)
            // A document edit invalidates source-map coordinates. The panel will
            // publish a fresh revision after the next audit instead of guessing.
            if (tr.docChanged) return DecorationSet.empty
            return value.map(tr.mapping, tr.doc)
          },
        },
        props: {
          decorations(state) {
            return continuityDiagnosticsPluginKey.getState(state) ?? DecorationSet.empty
          },
        },
      }),
    ]
  },
})

export function setContinuityDiagnostics(
  editor: { view?: { state: any; dispatch: (transaction: any) => void } } | null | undefined,
  markers: readonly ContinuityDiagnosticMarker[],
): void {
  const view = editor?.view
  if (!view) return
  const transaction = view.state.tr.setMeta(continuityDiagnosticsPluginKey, markers)
  view.dispatch(transaction)
}

export function clearContinuityDiagnostics(
  editor: { view?: { state: any; dispatch: (transaction: any) => void } } | null | undefined,
): void {
  setContinuityDiagnostics(editor, [])
}

function buildDecorations(doc: any, markers: readonly ContinuityDiagnosticMarker[]): DecorationSet {
  if (doc.content.size === 0 || markers.length === 0) return DecorationSet.empty

  const textSegments = buildTextSegments(doc)
  const decorations: Decoration[] = []
  const widgetPositions = new Set<string>()

  for (const marker of markers) {
    for (const location of marker.locations) {
      const from = mapTextOffset(textSegments, location.editorFrom, 'start', doc.content.size)
      const to = mapTextOffset(textSegments, location.editorTo, 'end', doc.content.size)
      const safeFrom = Math.min(from, to)
      const safeTo = Math.max(from, to)
      if (safeTo > safeFrom) {
        decorations.push(
          Decoration.inline(safeFrom, safeTo, {
            class: `ink-continuity-diagnostic ink-continuity-${marker.severity}`,
            'data-ink-continuity-finding': marker.findingId,
            title: marker.description,
          }),
        )
      }

      const widgetPosition = Math.max(1, Math.min(safeFrom, doc.content.size))
      const widgetKey = `${marker.findingId}:${location.blockId}:${widgetPosition}`
      if (widgetPositions.has(widgetKey)) continue
      widgetPositions.add(widgetKey)
      decorations.push(
        Decoration.widget(widgetPosition, () => createMarkerElement(marker, location), {
          side: -1,
          key: widgetKey,
        }),
      )
    }
  }

  return decorations.length === 0 ? DecorationSet.empty : DecorationSet.create(doc, decorations)
}

interface TextSegment {
  textFrom: number
  textTo: number
  docFrom: number
  docTo: number
}

function buildTextSegments(doc: any): TextSegment[] {
  const segments: TextSegment[] = []
  let textOffset = 0
  doc.forEach((block: any, blockOffset: number, index: number) => {
    if (index > 0) textOffset += 1
    let blockTextOffset = 0
    block.descendants((node: any, position: number) => {
      if (!node.isText || !node.text) return
      const length = node.text.length
      segments.push({
        textFrom: textOffset + blockTextOffset,
        textTo: textOffset + blockTextOffset + length,
        docFrom: blockOffset + 1 + position,
        docTo: blockOffset + 1 + position + length,
      })
      blockTextOffset += length
    })
    textOffset += block.textContent.length
  })
  return segments
}

function mapTextOffset(
  segments: readonly TextSegment[],
  offset: number,
  preference: 'start' | 'end',
  maxPosition: number,
): number {
  const safeOffset = Number.isFinite(offset) ? Math.max(0, offset) : 0
  const matching = segments.filter(
    (segment) => safeOffset >= segment.textFrom && safeOffset <= segment.textTo,
  )
  const segment =
    preference === 'start'
      ? (matching.find((candidate) => candidate.textFrom === safeOffset) ?? matching[0])
      : ([...matching].reverse().find((candidate) => candidate.textTo === safeOffset) ??
        matching[matching.length - 1])
  if (!segment) {
    const nearest = segments.find((candidate) => candidate.textFrom > safeOffset) ?? segments.at(-1)
    return Math.max(1, Math.min(nearest?.docTo ?? maxPosition, maxPosition))
  }
  const relative = Math.min(
    Math.max(safeOffset - segment.textFrom, 0),
    segment.textTo - segment.textFrom,
  )
  const position = preference === 'end' ? segment.docFrom + relative : segment.docFrom + relative
  return Math.max(1, Math.min(position, maxPosition))
}

function createMarkerElement(
  marker: ContinuityDiagnosticMarker,
  location: ContinuityDiagnosticMarker['locations'][number],
): HTMLElement {
  const element = document.createElement('span')
  element.className = `ink-continuity-marker ink-continuity-gutter-marker ink-continuity-marker-${marker.severity}`
  element.setAttribute('data-ink-continuity-marker', marker.findingId)
  element.setAttribute('data-ink-continuity-gutter-marker', marker.findingId)
  element.setAttribute('data-ink-continuity-block-id', location.blockId)
  element.setAttribute('data-ink-continuity-severity', marker.severity)
  element.setAttribute('data-ink-continuity-editor-from', String(location.editorFrom))
  element.setAttribute('data-ink-continuity-editor-to', String(location.editorTo))
  element.setAttribute('role', 'img')
  element.setAttribute('aria-label', `连续性诊断：${marker.description}`)
  element.title = marker.description
  // Keep the text flow unchanged while moving the widget into the paragraph's
  // left gutter. The surrounding editor already provides the gutter padding.
  element.style.marginLeft = '0'
  element.style.marginRight = '-0.45em'
  element.style.position = 'relative'
  element.style.left = '-1.25rem'
  element.textContent =
    marker.severity === 'error' ? '!' : marker.severity === 'warning' ? '⚠' : 'i'
  return element
}
