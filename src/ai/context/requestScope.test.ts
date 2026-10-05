import { describe, expect, it } from 'vitest'
import { createStoryEntity } from '../../domain/story/entities'
import { createStoryConstraint } from '../../domain/story/constraints'
import { createNarrativePromise } from '../../domain/story/promises'
import {
  createStoryState,
  upsertConstraint,
  upsertEntity,
  upsertPromise,
} from '../../domain/story/storyState'
import {
  ASSISTANT_HISTORY_TURN_LIMIT,
  formatAssistantRequestScope,
  projectAssistantRequestScope,
} from './requestScope'

const author = { sourceType: 'author', factLevel: 'canonical-fact', confidence: 1 } as const

const chapter = {
  id: 'ch-1',
  title: '断谷之夜',
  content: '0123456789',
  wordCount: 10,
  revision: 3,
}

describe('projectAssistantRequestScope', () => {
  it('counts every story collection rather than only entities', () => {
    let storyState = createStoryState(2)
    storyState = upsertEntity(
      storyState,
      createStoryEntity({ id: 'e-1', kind: 'character', name: '林寻', provenance: author }),
    )
    storyState = upsertEntity(
      storyState,
      createStoryEntity({ id: 'e-2', kind: 'sect', name: '青岭', provenance: author }),
    )
    storyState = upsertPromise(
      storyState,
      createNarrativePromise({
        id: 'p-1',
        statement: '未兑现的约定',
        status: 'open',
        provenance: author,
      }),
    )
    storyState = upsertConstraint(
      storyState,
      createStoryConstraint({
        id: 'c-1',
        type: 'world-rule',
        description: '灵气不能凭空产生',
        severity: 'info',
        provenance: author,
      }),
    )

    const scope = projectAssistantRequestScope({ chapter, storyState, historyMessages: [] })

    expect(scope.storyFactCount).toBe(4)
    expect(scope.chapterTitle).toBe('断谷之夜')
    expect(scope.selectionChars).toBe(0)
  })

  it('measures the selection against the document, clamping out-of-range offsets', () => {
    expect(
      projectAssistantRequestScope({
        chapter,
        selection: { from: 42, to: 3 },
        historyMessages: [],
      }).selectionChars,
    ).toBe(0)
    expect(
      projectAssistantRequestScope({
        chapter,
        selection: { from: 2, to: 999 },
        historyMessages: [],
      }).selectionChars,
    ).toBe(8)
  })

  it('caps disclosed history turns at the slice the send path actually uses', () => {
    const messages = Array.from({ length: 20 }, (_, index) => ({ role: 'user', text: `${index}` }))
    const scope = projectAssistantRequestScope({ chapter, historyMessages: messages })

    expect(scope.historyTurns).toBe(ASSISTANT_HISTORY_TURN_LIMIT)
    expect(scope.historyTurns).toBe(messages.slice(-ASSISTANT_HISTORY_TURN_LIMIT).length)
  })

  it('reports no chapter without inventing a title', () => {
    const scope = projectAssistantRequestScope({ historyMessages: [] })

    expect(scope.hasChapter).toBe(false)
    expect(scope.chapterTitle).toBeNull()
    expect(scope.storyFactCount).toBe(0)
  })
})

describe('formatAssistantRequestScope', () => {
  it('names the chapter, the story facts and the carried history', () => {
    const storyState = upsertEntity(
      createStoryState(1),
      createStoryEntity({ id: 'e-1', kind: 'character', name: '林寻', provenance: author }),
    )

    expect(
      formatAssistantRequestScope(
        projectAssistantRequestScope({
          chapter,
          storyState,
          historyMessages: [{ role: 'user', text: '前文' }],
        }),
      ),
    ).toBe('本次请求将发送：当前章节《断谷之夜》 · 设定 1 项 · 上文 1 条对话')
  })

  it('mentions the selection only when text is actually selected', () => {
    const withSelection = formatAssistantRequestScope(
      projectAssistantRequestScope({
        chapter,
        selection: { from: 0, to: 4 },
        historyMessages: [],
      }),
    )
    const emptySelection = formatAssistantRequestScope(
      projectAssistantRequestScope({
        chapter,
        selection: { from: 5, to: 5 },
        historyMessages: [],
      }),
    )

    expect(withSelection).toContain('选中文本')
    expect(emptySelection).not.toContain('选中文本')
    expect(emptySelection).not.toContain('上文')
    expect(emptySelection).toContain('设定 0 项')
  })

  it('says the prompt alone when no chapter is open', () => {
    expect(formatAssistantRequestScope(projectAssistantRequestScope({ historyMessages: [] }))).toBe(
      '本次请求将发送：你输入的指令 · 设定 0 项',
    )
  })
})
