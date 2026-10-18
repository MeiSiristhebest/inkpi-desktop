import { describe, expect, it } from 'vitest'
import { projectContent } from './semanticProjection'
import { resolveSourceEvidenceRange } from './sourceReference'

describe('resolveSourceEvidenceRange', () => {
  it('uses verified offsets to disambiguate repeated text in the same revision', () => {
    const document = projectContent('chapter-1', '重复引用。\n重复引用。', 4)

    expect(
      resolveSourceEvidenceRange(
        document,
        {
          documentId: 'chapter-1',
          excerpt: '重复引用。',
          semanticFrom: 6,
          semanticTo: 11,
        },
        true,
      ),
    ).toEqual({ from: 6, to: 11 })
  })

  it('re-finds a unique quote after earlier text shifts its saved offsets', () => {
    const document = projectContent('chapter-1', '新增开场。\n原文引用。', 5)

    expect(
      resolveSourceEvidenceRange(
        document,
        {
          documentId: 'chapter-1',
          excerpt: '原文引用。',
          semanticFrom: 0,
          semanticTo: 5,
        },
        false,
      ),
    ).toEqual({ from: 6, to: 11 })
  })

  it('refuses stale offsets when a changed document contains duplicate quotes', () => {
    const document = projectContent('chapter-1', '重复引用。\n重复引用。', 5)

    expect(
      resolveSourceEvidenceRange(
        document,
        {
          documentId: 'chapter-1',
          excerpt: '重复引用。',
          semanticFrom: 0,
          semanticTo: 5,
        },
        false,
      ),
    ).toBeNull()
  })

  it('rejects evidence for a different document', () => {
    const document = projectContent('chapter-1', '原文引用。', 4)

    expect(
      resolveSourceEvidenceRange(
        document,
        { documentId: 'chapter-2', excerpt: '原文引用。', semanticFrom: 0, semanticTo: 5 },
        true,
      ),
    ).toBeNull()
  })
})
