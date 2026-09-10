import { describe, expect, it } from 'vitest'
import { semanticDocumentFromText } from '../../domain/content'
import { projectContinuityFindingsToEditor } from './continuityDiagnostics'

describe('continuity diagnostic projection', () => {
  it('maps resolved block evidence to semantic and editor positions in document order', () => {
    const document = semanticDocumentFromText('chapter-1', '第一段\n第二段', 4)
    const [first, second] = document.blocks

    const [marker] = projectContinuityFindingsToEditor(document, [
      {
        id: 'finding-1',
        severity: 'warning',
        description: '跨段落连续性风险',
        blockIds: [second.id, first.id],
      },
    ])

    expect(marker).toMatchObject({
      findingId: 'finding-1',
      documentId: 'chapter-1',
      revision: 4,
      locationStatus: 'located',
      unresolvedBlockIds: [],
    })
    expect(marker.locations).toEqual([
      {
        blockId: first.id,
        semanticFrom: first.from,
        semanticTo: first.to,
        editorFrom: document.sourceMap.semanticRangeToEditor(first.from, first.to).from,
        editorTo: document.sourceMap.semanticRangeToEditor(first.from, first.to).to,
      },
      {
        blockId: second.id,
        semanticFrom: second.from,
        semanticTo: second.to,
        editorFrom: document.sourceMap.semanticRangeToEditor(second.from, second.to).from,
        editorTo: document.sourceMap.semanticRangeToEditor(second.from, second.to).to,
      },
    ])
  })

  it('keeps findings without resolvable block evidence unlocated', () => {
    const document = semanticDocumentFromText('chapter-1', '正文', 1)

    expect(
      projectContinuityFindingsToEditor(document, [
        { id: 'missing', severity: 'info', description: '没有区块证据' },
        { id: 'unknown', severity: 'error', description: '区块已变化', blockIds: ['stale-block'] },
      ]),
    ).toEqual([
      expect.objectContaining({
        findingId: 'missing',
        locationStatus: 'unlocated',
        unlocatedReason: 'missing-block-evidence',
        unresolvedBlockIds: [],
        locations: [],
      }),
      expect.objectContaining({
        findingId: 'unknown',
        locationStatus: 'unlocated',
        unlocatedReason: 'unknown-block',
        unresolvedBlockIds: ['stale-block'],
        locations: [],
      }),
    ])
  })
})
