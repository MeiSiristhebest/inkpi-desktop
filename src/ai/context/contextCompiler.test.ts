import { describe, expect, it } from 'vitest'
import { semanticDocumentFromText } from '../../domain/content'
import { createStoryEntity } from '../../domain/story/entities'
import { createStoryState, upsertEntity } from '../../domain/story/storyState'
import { compileCreativeContext } from './contextCompiler'

describe('creative context compiler', () => {
  it('compiles the real document selection and canonical story context', () => {
    const document = semanticDocumentFromText('chapter-1', '甲乙丙丁', 3)
    let story = createStoryState(8)
    story = upsertEntity(story, createStoryEntity({
      id: 'hero',
      kind: 'character',
      name: '甲',
      provenance: { sourceType: 'author', factLevel: 'canonical-fact', confidence: 1 },
    }))

    const context = compileCreativeContext({
      document,
      selection: { from: 1, to: 3 },
      storyState: story,
      projectRevision: 9,
    })

    expect(context).toMatchObject({
      documentId: 'chapter-1',
      revision: 3,
      text: '甲乙丙丁',
      selectionText: '乙丙',
      projectRevision: 9,
      storyContext: {
        revision: 8,
        canonicalFacts: [expect.objectContaining({ id: 'hero', canonical: true })],
      },
    })
    expect(context.fingerprint).toMatch(/^[0-9a-f]{8}$/)
  })

  it('clamps invalid selections and keeps fingerprints sensitive to context changes', () => {
    const document = semanticDocumentFromText('chapter-1', 'abcdef', 1)
    const clamped = compileCreativeContext({ document, selection: { from: -4, to: 99 } })
    const changed = compileCreativeContext({ document, selection: { from: 0, to: 2 } })

    expect(clamped.selectionText).toBe('abcdef')
    expect(changed.selectionText).toBe('ab')
    expect(clamped.fingerprint).not.toBe(changed.fingerprint)
  })
})
