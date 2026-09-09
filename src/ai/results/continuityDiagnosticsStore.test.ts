import { describe, expect, it, vi } from 'vitest'
import type { ContinuityDiagnosticMarker } from './continuityDiagnostics'
import { continuityDiagnosticsStore } from './continuityDiagnosticsStore'

const marker: ContinuityDiagnosticMarker = {
  findingId: 'finding-1',
  severity: 'warning',
  description: '存在连续性风险',
  documentId: 'chapter-1',
  revision: 2,
  locationStatus: 'located',
  unresolvedBlockIds: [],
  locations: [
    {
      blockId: 'block-1',
      semanticFrom: 0,
      semanticTo: 2,
      editorFrom: 0,
      editorTo: 2,
    },
  ],
}

describe('continuity diagnostics store', () => {
  it('publishes isolated marker snapshots to matching editor subscribers', () => {
    const listener = vi.fn()
    const unsubscribe = continuityDiagnosticsStore.subscribe('project-1', 'chapter-1', listener)

    continuityDiagnosticsStore.set('project-1', 'chapter-1', [marker])
    const loaded = continuityDiagnosticsStore.get('project-1', 'chapter-1')

    expect(listener).toHaveBeenCalledOnce()
    expect(loaded).toEqual([marker])
    expect(loaded).not.toBe(marker)
    expect(loaded[0]).not.toBe(marker)

    unsubscribe()
    continuityDiagnosticsStore.clear('project-1', 'chapter-1')
    expect(listener).toHaveBeenCalledOnce()
    expect(continuityDiagnosticsStore.get('project-1', 'chapter-1')).toEqual([])
  })

  it('does not mix marker snapshots across projects or chapters', () => {
    continuityDiagnosticsStore.set('project-a', 'chapter-1', [marker])

    expect(continuityDiagnosticsStore.get('project-a', 'chapter-2')).toEqual([])
    expect(continuityDiagnosticsStore.get('project-b', 'chapter-1')).toEqual([])

    continuityDiagnosticsStore.clear('project-a', 'chapter-1')
  })
})
