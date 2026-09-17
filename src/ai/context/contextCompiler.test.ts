import { describe, expect, it } from 'vitest'
import { semanticDocumentFromText } from '../../domain/content'
import { createStoryEntity } from '../../domain/story/entities'
import { createStoryState, upsertEntity } from '../../domain/story/storyState'
import { compileCreativeContext } from './contextCompiler'

describe('creative context compiler', () => {
  it('compiles the real document selection and canonical story context', () => {
    const document = semanticDocumentFromText('chapter-1', '甲乙丙丁', 3)
    let story = createStoryState(8)
    story = upsertEntity(
      story,
      createStoryEntity({
        id: 'hero',
        kind: 'character',
        name: '甲',
        provenance: { sourceType: 'author', factLevel: 'canonical-fact', confidence: 1 },
      }),
    )

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

  it('clamps scene text when totalTokenBudget is exceeded to protect story/JIT memory', () => {
    // 假设正文极长（例如 4000 字符），但分配给 scene 的预算只有 100 tokens (约 400 字符)
    const longText = '长文本段落。'.repeat(400)
    const document = semanticDocumentFromText('chapter-long', longText, 1)

    const context = compileCreativeContext({
      document,
      selection: { from: 1000, to: 1050 },
      totalTokenBudget: 500, // 500 tokens * 40% = 200 sceneTokens = 800 chars
    })

    expect(context.budget).toBeDefined()
    expect(context.budget!.sceneTokens).toBe(200)
    expect(context.text.length).toBeLessThanOrEqual(800)
    // 选区文字应被保留在切片中
    expect(context.text).toContain(longText.slice(1000, 1050))
  })
})
