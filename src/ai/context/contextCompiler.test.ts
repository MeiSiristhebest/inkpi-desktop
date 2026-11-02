import { describe, expect, it } from 'vitest'
import { semanticDocumentFromText } from '../../domain/content'
import {
  prepareReferenceMaterials,
  type ReferenceSourceRecord,
} from '../../domain/references/referenceMaterials'
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
      neighboringDocuments: [semanticDocumentFromText('chapter-0', '此前内容', 2)],
      storyState: story,
      activeEntityIds: ['hero', 'hero'],
      activePromiseIds: ['promise-1'],
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
      coverage: {
        version: 1,
        documentText: {
          sourceCharacters: 4,
          includedCharacters: 4,
          rangeStart: 0,
          rangeEnd: 4,
        },
        selectionText: {
          explicitSelection: true,
          sourceCharacters: 2,
          includedCharacters: 2,
          rangeStart: 1,
          rangeEnd: 3,
        },
        semanticBlocks: { count: document.blocks.length, characters: 4 },
        neighboringDocuments: { count: 1, characters: 4 },
        storyState: { attached: true, recordCount: 1 },
        storyContext: { canonicalFactCount: 1 },
        jit: { entityCount: 1, promiseCount: 1 },
      },
    })
    expect(context.fingerprint).toMatch(/^[0-9a-f]{8}$/)
  })

  it('clamps invalid selections and keeps fingerprints sensitive to context changes', () => {
    const document = semanticDocumentFromText('chapter-1', 'abcdef', 1)
    const clamped = compileCreativeContext({ document, selection: { from: -4, to: 99 } })
    const changed = compileCreativeContext({ document, selection: { from: 0, to: 2 } })
    const noExplicitSelection = compileCreativeContext({ document })

    expect(clamped.selectionText).toBe('abcdef')
    expect(changed.selectionText).toBe('ab')
    expect(noExplicitSelection.coverage.selectionText).toEqual({
      explicitSelection: false,
      sourceCharacters: 6,
      includedCharacters: 6,
      rangeStart: 0,
      rangeEnd: 6,
    })
    expect(clamped.fingerprint).not.toBe(changed.fingerprint)
  })

  it('includes selected reference excerpts within a dedicated budget and fingerprints their content', () => {
    const document = semanticDocumentFromText('chapter-1', '女主穿过北京地铁站。', 1)
    const source: ReferenceSourceRecord = {
      id: 'reference-city',
      title: '城市交通资料',
      originalFileName: 'city.txt',
      format: 'txt',
      text: '北京地铁沿线的通勤人群带动周边社区更新。',
      tags: ['都市'],
      contentFingerprint: 'city-fingerprint',
      importedAt: 1,
      updatedAt: 1,
    }
    const referenceMaterials = prepareReferenceMaterials(
      [source],
      [source.id],
      '北京地铁通勤',
      2_000,
    )
    const context = compileCreativeContext({
      document,
      referenceMaterials,
      totalTokenBudget: 4_000,
    })
    const withoutReferences = compileCreativeContext({ document, totalTokenBudget: 4_000 })

    expect(context.referenceMaterials?.excerpts[0]?.text).toContain('北京地铁')
    expect(context.budget?.externalReferenceTokens).toBe(400)
    expect(context.coverage.referenceMaterials).toMatchObject({
      sourceCount: 1,
      selectedCount: 1,
      includedCount: 1,
      omittedCount: 0,
    })
    expect(JSON.stringify(context.coverage)).not.toContain(source.text)
    expect(context.fingerprint).not.toBe(withoutReferences.fingerprint)
    expect(withoutReferences.budget?.externalReferenceTokens).toBe(0)
    expect(withoutReferences.budget?.sceneTokens).toBe(1_600)
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
    expect(context.coverage).toMatchObject({
      documentText: {
        sourceCharacters: longText.length,
        includedCharacters: 800,
        rangeStart: 625,
        rangeEnd: 1425,
      },
      selectionText: {
        explicitSelection: true,
        sourceCharacters: 50,
        includedCharacters: 50,
        rangeStart: 1000,
        rangeEnd: 1050,
      },
      semanticBlocks: {
        count: document.blocks.length,
        characters: longText.length,
      },
      storyState: { attached: false, recordCount: 0 },
      storyContext: { recordCount: 0, canonicalFactCount: 0, hypothesisCount: 0 },
    })
  })
})
