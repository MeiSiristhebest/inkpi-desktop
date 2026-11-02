import { describe, expect, it } from 'vitest'
import { semanticDocumentFromText } from '../../domain/content'
import {
  prepareReferenceMaterials,
  type ReferenceSourceRecord,
} from '../../domain/references/referenceMaterials'
import { createAssistantTask, createRoleplayTask } from './taskFactories'

describe('creative task prepared context coverage', () => {
  it('attaches the Desktop compilation summary to task metadata without source text', () => {
    const document = semanticDocumentFromText('chapter-1', '甲乙丙丁戊', 3)
    const task = createAssistantTask({
      taskId: 'task-coverage',
      workspaceId: 'workspace-1',
      document,
      question: '请分析当前章节',
    })

    expect(task.metadata?.desktopPreparedContextCoverage).toMatchObject({
      version: 1,
      documentText: {
        sourceCharacters: 5,
        includedCharacters: 5,
        rangeStart: 0,
        rangeEnd: 5,
      },
      selectionText: {
        explicitSelection: false,
        sourceCharacters: 5,
        includedCharacters: 5,
        rangeStart: 0,
        rangeEnd: 5,
      },
      storyState: { attached: false, recordCount: 0 },
    })
    expect(JSON.stringify(task.metadata?.desktopPreparedContextCoverage)).not.toContain(
      '甲乙丙丁戊',
    )
  })

  it('prepares roleplay from sandbox context without loading project story or retrieval providers', () => {
    const document = semanticDocumentFromText(
      'roleplay-session-1',
      'Scenario: a city under glass.\nPlayer: Mira.\nAI character: the archivist.\nNotes: the east gate is sealed.',
      4,
    )
    const task = createRoleplayTask({
      taskId: 'roleplay-turn-1',
      workspaceId: 'workspace-1',
      document,
      question: 'I ask the archivist about the gate.',
      conversationHistory: [{ role: 'user', text: 'We arrive at the city.' }],
    })
    const payload = task.input.payload as Record<string, unknown>

    expect(task.kind).toBe('creative.assistant')
    expect(task.contextPolicy).toMatchObject({
      providerIds: ['creative.conversation-history'],
      includeSelection: false,
      includeProjectState: false,
    })
    expect(task.effectPolicy).toEqual({ mode: 'read-only' })
    expect(task.outputContract).toMatchObject({ persistence: 'ephemeral' })
    expect(payload.question).toBe('I ask the archivist about the gate.')
    expect(payload.conversationHistory).toEqual([{ role: 'user', text: 'We arrive at the city.' }])
    expect(task.metadata?.roleplaySandbox).toBe(true)
    expect(task.contextPolicy?.providerIds).not.toContain('creative.story')
    expect(task.contextPolicy?.providerIds).not.toContain('retrieval.jit')
    expect(task.contextPolicy?.providerIds).not.toContain('creative.references')
  })

  it('passes explicitly selected excerpts in task details and keeps the coverage text-free', () => {
    const document = semanticDocumentFromText('chapter-1', '女主走进城市。', 3)
    const source: ReferenceSourceRecord = {
      id: 'reference-1',
      title: '都市交通资料',
      originalFileName: 'urban.md',
      format: 'md',
      text: '北京地铁连接城市社区，通勤线路影响居民日常生活。',
      tags: ['都市'],
      contentFingerprint: 'fingerprint',
      importedAt: 1,
      updatedAt: 1,
    }
    const referenceMaterials = prepareReferenceMaterials([source], [source.id], '北京地铁通勤', 400)
    const task = createAssistantTask({
      taskId: 'task-with-reference',
      workspaceId: 'workspace-1',
      document,
      question: '请分析都市通勤',
      referenceMaterials,
    })
    const payload = task.input.payload as Record<string, unknown>
    const context = payload.context as Record<string, unknown>

    expect(task.contextPolicy?.providerIds).toContain('creative.references')
    expect(context.referenceMaterials).toMatchObject({
      excerpts: [expect.objectContaining({ sourceId: source.id, sourceTitle: source.title })],
    })
    expect(payload).not.toHaveProperty('authorSelectedReferenceExcerpts')
    expect(task.metadata?.desktopPreparedContextCoverage).toMatchObject({
      referenceMaterials: {
        sourceCount: 1,
        selectedCount: 1,
        includedCount: 1,
        omittedCount: 0,
      },
    })
    expect(JSON.stringify(task.metadata?.desktopPreparedContextCoverage)).not.toContain(source.text)
  })
})
