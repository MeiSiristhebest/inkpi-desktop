import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ChapterRecord } from '../../types'
import { chapterSaveEvents } from '../../ports/chapterSaveEvents'
import { ActiveWritingContextProvider } from '../../core/activeWritingContext'
import type { ContinuityAuditTaskInput } from '../../ai/tasks/taskFactories'
import type { ContinuityFinding } from '../../ai/results/taskResults'
import type {
  DistillationWorkflowOptions,
  DistillationWorkflowResult,
  ProjectDistillationInput,
} from '../../ai/orchestrator/verticalSlices'
import { CreativeWorkflowsPanel } from './CreativeWorkflowsPanel'

const chapter: ChapterRecord = {
  id: 'chapter-1',
  projectId: 'project-1',
  volumeId: 'volume-1',
  title: '第一章',
  order: 1,
  content: '<p>雨停后，她没有回头。</p>',
  wordCount: 10,
  revision: 3,
  createdAt: 1,
  updatedAt: 1,
}

describe('CreativeWorkflowsPanel', () => {
  it('runs continuity audit from the UI with canonical HTML input and source mapping', async () => {
    let auditedBlockId = ''
    const audit = vi.fn(
      async (input: {
        document: {
          text: string
          representation: string
          blocks: Array<{ id: string }>
          sourceMap: {
            semanticRangeToEditor: (from: number, to: number) => { from: number; to: number }
          }
        }
      }) => {
        expect(input.document.text).toBe('雨停后，她没有回头。')
        expect(input.document.representation).toBe('html')
        expect(input.document.sourceMap.semanticRangeToEditor(0, 1)).toMatchObject({
          from: 3,
          to: 4,
        })
        auditedBlockId = input.document.blocks[0].id
        return [
          {
            id: 'finding-1',
            severity: 'warning' as const,
            description: '存在未回收伏笔',
            blockIds: [input.document.blocks[0].id],
          },
        ]
      },
    )
    render(
      <CreativeWorkflowsPanel
        projectId="project-1"
        chapters={[chapter]}
        connected
        onContinuityAudit={audit}
        onDeepReasoning={vi.fn()}
        onDistillationWorkflow={vi.fn()}
        onSteerTask={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '审计当前章节' }))
    await waitFor(() =>
      expect(screen.getByTestId('continuity-findings')).toHaveTextContent('存在未回收伏笔'),
    )
    expect(screen.getByTestId('continuity-diagnostic')).toHaveAttribute(
      'data-location-kind',
      'located',
    )
    expect(screen.getByTestId('continuity-diagnostic-location')).toHaveAttribute(
      'data-block-id',
      auditedBlockId,
    )
    expect(screen.getByTestId('continuity-diagnostic-location')).toHaveTextContent('编辑器位置')
    expect(audit).toHaveBeenCalledOnce()
  })

  it('debounces a continuity audit after the selected chapter is saved', async () => {
    const audit = vi.fn(
      async (input: { document: { text: string; blocks: Array<{ id: string }> } }) => [
        {
          id: 'saved-finding',
          severity: 'info' as const,
          description: '保存后诊断',
          blockIds: [input.document.blocks[0].id],
        },
      ],
    )
    render(
      <CreativeWorkflowsPanel
        projectId="project-1"
        chapters={[chapter]}
        connected
        onContinuityAudit={audit}
        onDeepReasoning={vi.fn()}
        onDistillationWorkflow={vi.fn()}
        onSteerTask={vi.fn()}
      />,
    )

    act(() => {
      chapterSaveEvents.publish({ ...chapter, content: '<p>保存后的正文</p>', revision: 4 })
    })

    await waitFor(() => expect(audit).toHaveBeenCalledOnce(), { timeout: 3000 })
    expect(audit.mock.calls[0][0].document.text).toBe('保存后的正文')
    expect(screen.getByTestId('continuity-findings')).toHaveTextContent('保存后诊断')
  })

  it('runs deep reasoning and forwards interactive steering while the task is pending', async () => {
    let resolveReasoning!: (value: {
      answer: string
      assumptions: string[]
      alternatives: string[]
      risks: string[]
    }) => void
    const reasoning = vi.fn(
      (
        _input: unknown,
        options?: {
          onProgress?: (snapshot: { taskId: string; kind: string; status: 'running' }) => void
        },
      ) => {
        options?.onProgress?.({
          taskId: 'deep-task',
          kind: 'narrative.deep.reason',
          status: 'running',
        })
        return new Promise<{
          answer: string
          assumptions: string[]
          alternatives: string[]
          risks: string[]
        }>((resolve) => {
          resolveReasoning = resolve
        })
      },
    )
    const steer = vi.fn(async () => true)
    render(
      <CreativeWorkflowsPanel
        projectId="project-1"
        chapters={[chapter]}
        connected
        onContinuityAudit={vi.fn()}
        onDeepReasoning={reasoning}
        onDistillationWorkflow={vi.fn()}
        onSteerTask={steer}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '深度推理' }))
    fireEvent.click(screen.getByRole('button', { name: '开始深度推理' }))
    await waitFor(() => expect(reasoning).toHaveBeenCalledOnce())
    fireEvent.change(screen.getByLabelText('推理 steering'), { target: { value: '保持冷色意象' } })
    fireEvent.click(screen.getByRole('button', { name: '引导' }))
    await waitFor(() =>
      expect(steer).toHaveBeenCalledWith(expect.any(String), { direction: '保持冷色意象' }),
    )
    resolveReasoning({ answer: '保留冷色意象', assumptions: [], alternatives: [], risks: [] })
    await waitFor(() =>
      expect(screen.getByTestId('deep-reasoning-result')).toHaveTextContent('保留冷色意象'),
    )
  })

  it('cancels a running deep reasoning task through its AbortSignal', async () => {
    const reasoning = vi.fn(
      (_input: unknown, options?: { signal?: AbortSignal }) =>
        new Promise<never>((_resolve, reject) => {
          options?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('aborted', 'AbortError')),
            { once: true },
          )
        }),
    )
    render(
      <CreativeWorkflowsPanel
        projectId="project-1"
        chapters={[chapter]}
        connected
        onContinuityAudit={vi.fn()}
        onDeepReasoning={reasoning}
        onDistillationWorkflow={vi.fn()}
        onSteerTask={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '深度推理' }))
    fireEvent.click(screen.getByRole('button', { name: '开始深度推理' }))
    await waitFor(() => expect(reasoning).toHaveBeenCalledOnce())
    expect(reasoning.mock.calls[0][1]?.signal?.aborted).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: '取消深度推理' }))
    await waitFor(() => expect(screen.getByRole('button', { name: '开始深度推理' })).toBeEnabled())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows a human-intervention state reported by the Runtime', async () => {
    let resolveReasoning!: (value: {
      answer: string
      assumptions: string[]
      alternatives: string[]
      risks: string[]
    }) => void
    const reasoning = vi.fn(
      (
        _input: unknown,
        options?: {
          onProgress?: (snapshot: { taskId: string; kind: string; status: 'waiting-user' }) => void
        },
      ) => {
        options?.onProgress?.({
          taskId: 'deep-waiting',
          kind: 'narrative.deep.reason',
          status: 'waiting-user',
        })
        return new Promise<{
          answer: string
          assumptions: string[]
          alternatives: string[]
          risks: string[]
        }>((resolve) => {
          resolveReasoning = resolve
        })
      },
    )
    render(
      <CreativeWorkflowsPanel
        projectId="project-1"
        chapters={[chapter]}
        connected
        onContinuityAudit={vi.fn()}
        onDeepReasoning={reasoning}
        onDistillationWorkflow={vi.fn()}
        onSteerTask={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '深度推理' }))
    fireEvent.click(screen.getByRole('button', { name: '开始深度推理' }))
    await waitFor(() =>
      expect(screen.getByTestId('workflow-waiting-user')).toHaveTextContent('等待人工输入'),
    )
    resolveReasoning({ answer: '继续', assumptions: [], alternatives: [], risks: [] })
    await waitFor(() =>
      expect(screen.getByTestId('deep-reasoning-result')).toHaveTextContent('继续'),
    )
  })

  it('runs project distillation with a resumable checkpoint', async () => {
    const distill = vi.fn(
      async (
        _input: unknown,
        options: {
          onProgress?: (progress: {
            completedChunks: number
            totalChunks: number
            failedChunks: string[]
          }) => void
          checkpoint?: unknown
        },
      ) => {
        options.onProgress?.({ completedChunks: 1, totalChunks: 1, failedChunks: [] })
        return {
          facts: { summary: '项目提炼完成', entities: [], events: [], promises: [] },
          complete: true,
          failedChunks: [],
          completedChunks: 1,
          totalChunks: 1,
          checkpoint: {
            nextChunk: 1,
            completedChunkIndexes: [0],
            failedChunkIndexes: [],
            failedChunks: [],
            facts: { summary: '项目提炼完成', entities: [], events: [], promises: [] },
          },
          chunkTaskIds: ['project-distillation:chunk:0'],
        }
      },
    )
    render(
      <CreativeWorkflowsPanel
        projectId="project-1"
        chapters={[chapter]}
        connected
        onContinuityAudit={vi.fn()}
        onDeepReasoning={vi.fn()}
        onDistillationWorkflow={distill}
        onSteerTask={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '项目提炼' }))
    fireEvent.click(screen.getByRole('button', { name: '开始项目提炼' }))
    await waitFor(() =>
      expect(screen.getByTestId('distillation-result')).toHaveTextContent('项目提炼完成'),
    )
    expect(distill).toHaveBeenCalledWith(
      expect.objectContaining({
        documents: [expect.objectContaining({ text: '雨停后，她没有回头。' })],
      }),
      expect.objectContaining({ checkpoint: undefined }),
    )
  })

  it('reports failed chunks as terminal progress instead of leaving the workflow running', async () => {
    const distill = vi.fn(
      async (
        _input: unknown,
        options: {
          onProgress?: (progress: {
            completedChunks: number
            totalChunks: number
            failedChunks: string[]
          }) => void
        },
      ) => {
        options.onProgress?.({ completedChunks: 0, totalChunks: 1, failedChunks: ['chunk-0'] })
        return {
          facts: { summary: '部分完成', entities: [], events: [], promises: [] },
          complete: false,
          failedChunks: ['chunk-0'],
          completedChunks: 0,
          totalChunks: 1,
          checkpoint: {
            nextChunk: 1,
            completedChunkIndexes: [],
            failedChunkIndexes: [0],
            failedChunks: ['chunk-0'],
            facts: { summary: '部分完成', entities: [], events: [], promises: [] },
          },
          chunkTaskIds: ['project-distillation:chunk:0'],
        }
      },
    )
    render(
      <CreativeWorkflowsPanel
        projectId="project-1"
        chapters={[chapter]}
        connected
        onContinuityAudit={vi.fn()}
        onDeepReasoning={vi.fn()}
        onDistillationWorkflow={distill}
        onSteerTask={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '项目提炼' }))
    fireEvent.click(screen.getByRole('button', { name: '开始项目提炼' }))

    await waitFor(() =>
      expect(screen.getByTestId('workflow-progress')).toHaveTextContent('100% · failed'),
    )
    expect(screen.getByTestId('distillation-result')).toHaveTextContent('待重试：1')
  })

  it('rehydrates a matching checkpoint before running and persists workflow checkpoints', async () => {
    const stored = {
      nextChunk: 1,
      completedChunkIndexes: [0],
      failedChunkIndexes: [],
      failedChunks: [],
      facts: { summary: '已完成第一块', entities: [], events: [], promises: [] },
    }
    const checkpointStore = {
      load: vi.fn(async () => structuredClone(stored)),
      save: vi.fn(async () => undefined),
      clear: vi.fn(async () => undefined),
    }
    const next = {
      nextChunk: 2,
      completedChunkIndexes: [0, 1],
      failedChunkIndexes: [],
      failedChunks: [],
      facts: { summary: '项目提炼完成', entities: [], events: [], promises: [] },
    }
    const distill = vi.fn(
      async (
        _input: unknown,
        options: {
          checkpoint?: unknown
          saveCheckpoint?: (checkpoint: typeof next) => Promise<void>
        },
      ) => {
        expect(options.checkpoint).toEqual(stored)
        await options.saveCheckpoint?.(next)
        return {
          facts: next.facts,
          complete: true,
          failedChunks: [],
          completedChunks: 2,
          totalChunks: 2,
          checkpoint: next,
          chunkTaskIds: ['project-distillation:chunk:1'],
        }
      },
    )
    render(
      <CreativeWorkflowsPanel
        projectId="project-1"
        chapters={[chapter]}
        connected
        onContinuityAudit={vi.fn()}
        onDeepReasoning={vi.fn()}
        onDistillationWorkflow={distill}
        onSteerTask={vi.fn()}
        distillationCheckpointStore={checkpointStore}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '项目提炼' }))
    await waitFor(() => expect(screen.getByRole('button', { name: '继续项目提炼' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: '继续项目提炼' }))

    await waitFor(() =>
      expect(screen.getByTestId('distillation-result')).toHaveTextContent('项目提炼完成'),
    )
    expect(checkpointStore.load).toHaveBeenCalledWith(
      'project-1',
      expect.stringMatching(/^project-1:distill:/),
      expect.any(String),
    )
    expect(checkpointStore.save).toHaveBeenCalledWith(
      'project-1',
      expect.stringMatching(/^project-1:distill:/),
      next,
      expect.any(String),
    )
  })

  it('ingests distillation results into review inbox and opens DistillationInboxModal', async () => {
    const distillResult = {
      facts: {
        summary: '提炼成功',
        entities: [{ id: 'ent-1', kind: 'character', name: '林澈', attributes: { role: '主角' } }],
        events: [],
        promises: [{ id: 'prom-1', statement: '三年之约' }],
      },
      complete: true,
      failedChunks: [],
      completedChunks: 1,
      totalChunks: 1,
      checkpoint: {
        facts: { summary: '提炼成功', entities: [], events: [], promises: [] },
        completedChunkIndexes: [0],
        failedChunkIndexes: [],
        failedChunks: [],
        nextChunk: 1,
        chunkCount: 1,
        step: 'distill-finished',
        updatedAt: 100,
      },
      chunkTaskIds: ['task-1'],
    }

    render(
      <CreativeWorkflowsPanel
        projectId="project-1"
        chapters={[chapter]}
        connected
        onContinuityAudit={vi.fn()}
        onDeepReasoning={vi.fn()}
        onDistillationWorkflow={vi.fn().mockResolvedValue(distillResult)}
        onSteerTask={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '项目提炼' }))
    fireEvent.click(screen.getByRole('button', { name: '开始项目提炼' }))

    await waitFor(() => expect(screen.getByText(/审查事实提炼/)).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /审查事实提炼/ }))

    expect(screen.getByText('AI 事实提炼审查箱 (Distillation Review Inbox)')).toBeInTheDocument()
    expect(screen.getByText('林澈')).toBeInTheDocument()
    expect(screen.getByText('三年之约')).toBeInTheDocument()
  })

  it('restores pending distillation review items on mount without requiring distillation run', async () => {
    const { distillationReviewInbox } = await import('../../ai/proposals/distillationReviewInbox')
    await distillationReviewInbox.ingestDistilledFacts('project-1', 'task-stored', {
      summary: '历史提炼',
      entities: [{ kind: 'character', name: '历史人物' }],
      events: [],
      promises: [],
    })

    render(
      <CreativeWorkflowsPanel
        projectId="project-1"
        chapters={[chapter]}
        connected
        onContinuityAudit={vi.fn()}
        onDeepReasoning={vi.fn()}
        onDistillationWorkflow={vi.fn()}
        onSteerTask={vi.fn()}
      />,
    )

    await waitFor(() => expect(screen.getByText(/审查提炼/)).toBeInTheDocument())
    fireEvent.click(screen.getByText(/审查提炼/))

    expect(screen.getByText('AI 事实提炼审查箱 (Distillation Review Inbox)')).toBeInTheDocument()
    expect(screen.getByText('历史人物')).toBeInTheDocument()
  })

  it('opens merge picker and merges into existing entity', async () => {
    const { distillationReviewInbox } = await import('../../ai/proposals/distillationReviewInbox')
    const { indexedDbCodexEntityRepository } =
      await import('../../adapters/indexedDbCodexEntityRepository')

    await indexedDbCodexEntityRepository.save({
      id: 'existing-entity-1',
      projectId: 'project-1',
      name: '既有掌门',
      category: 'character',
      summary: '宗门掌门人',
      tags: [],
      customFields: {},
      createdAt: 10,
      updatedAt: 10,
      revision: 1,
    } as any)

    await distillationReviewInbox.ingestDistilledFacts('project-1', 'task-merge', {
      summary: '合并测试提炼',
      entities: [{ kind: 'character', name: '新发现掌门' }],
      events: [],
      promises: [],
    })

    const mergeSpy = vi.spyOn(distillationReviewInbox, 'mergeIntoEntity')

    render(
      <CreativeWorkflowsPanel
        projectId="project-1"
        chapters={[chapter]}
        connected
        onContinuityAudit={vi.fn()}
        onDeepReasoning={vi.fn()}
        onDistillationWorkflow={vi.fn()}
        onSteerTask={vi.fn()}
      />,
    )

    await waitFor(() => expect(screen.getByText(/审查提炼/)).toBeInTheDocument())
    fireEvent.click(screen.getByText(/审查提炼/))

    expect(screen.getByText('新发现掌门')).toBeInTheDocument()
    const mergeBtns = screen.getAllByRole('button', { name: '合并已有实体' })
    fireEvent.click(mergeBtns[0])

    await waitFor(() => expect(screen.getByTestId('distillation-merge-picker')).toBeInTheDocument())
    expect(screen.getByText('选择合并目标实体')).toBeInTheDocument()
    expect(screen.getByText('既有掌门')).toBeInTheDocument()

    fireEvent.click(screen.getByText('既有掌门'))

    await waitFor(() => {
      expect(mergeSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ id: 'existing-entity-1', name: '既有掌门' }),
      )
    })
    await waitFor(() => {
      expect(screen.queryByTestId('distillation-merge-picker')).not.toBeInTheDocument()
    })
  })

  it('generates a chapter synopsis and writes it through the authoritative mutation path', async () => {
    const synopsis = '雨停后她离城，剑匣留在原地。'
    const distill = vi.fn(
      async (
        _input: ProjectDistillationInput,
        _options?: DistillationWorkflowOptions,
      ): Promise<DistillationWorkflowResult> => ({
        facts: { summary: synopsis, entities: [], events: [], promises: [] },
        complete: true,
        failedChunks: [],
        completedChunks: 1,
        totalChunks: 1,
        checkpoint: {
          nextChunk: 1,
          completedChunkIndexes: [0],
          failedChunkIndexes: [],
          failedChunks: [],
          facts: { summary: synopsis, entities: [], events: [], promises: [] },
        },
        chunkTaskIds: ['chapter-1:chunk:0'],
      }),
    )
    const mutate = vi.fn(async () => ({
      success: true as const,
      conflict: false as const,
      previousRevision: 3,
      newRevision: 4,
      chapter: { ...chapter, synopsis, revision: 4 },
      wordCountDelta: 0,
    }))

    render(
      <CreativeWorkflowsPanel
        projectId="project-1"
        chapters={[chapter]}
        connected
        onContinuityAudit={vi.fn()}
        onDeepReasoning={vi.fn()}
        onDistillationWorkflow={distill}
        onSteerTask={vi.fn()}
        chapterMutation={{ mutate }}
      />,
    )

    expect(screen.getByTestId('chapter-synopsis')).toHaveTextContent('暂无梗概')

    fireEvent.click(screen.getByRole('button', { name: '生成本章梗概' }))

    await waitFor(() => expect(screen.getByTestId('chapter-synopsis')).toHaveTextContent(synopsis))
    expect(screen.getByRole('button', { name: '重新生成' })).toBeInTheDocument()
    expect(distill).toHaveBeenCalledOnce()
    const [input, options] = distill.mock.calls[0]
    expect(input.target).toBe('document')
    expect(input.fields).toEqual(['summary'])
    expect(input.documents[0].text).toBe('雨停后，她没有回头。')
    expect(options.chunkSize).toBe(1)
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'project-1',
        chapterId: 'chapter-1',
        expectedRevision: 3,
        origin: 'ai-rewrite',
        mutation: { type: 'update-synopsis', synopsis },
      }),
    )
  })

  it('reports a synopsis failure instead of showing a stale summary', async () => {
    const mutate = vi.fn(async () => ({
      success: false as const,
      conflict: true as const,
      currentRevision: 5,
      error: 'CAS Conflict: expected revision 3, but current revision is 5',
    }))

    render(
      <CreativeWorkflowsPanel
        projectId="project-1"
        chapters={[{ ...chapter, synopsis: '旧梗概' }]}
        connected
        onContinuityAudit={vi.fn()}
        onDeepReasoning={vi.fn()}
        onDistillationWorkflow={vi.fn(async () => ({
          facts: { summary: '新梗概', entities: [], events: [], promises: [] },
          complete: true,
          failedChunks: [],
          completedChunks: 1,
          totalChunks: 1,
          checkpoint: {
            nextChunk: 1,
            completedChunkIndexes: [0],
            failedChunkIndexes: [],
            failedChunks: [],
            facts: { summary: '新梗概', entities: [], events: [], promises: [] },
          },
          chunkTaskIds: [],
        }))}
        onSteerTask={vi.fn()}
        chapterMutation={{ mutate }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '重新生成' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('CAS Conflict'))
    expect(screen.getByTestId('chapter-synopsis')).toHaveTextContent('旧梗概')
  })
})

describe('CreativeWorkflowsPanel 的活动章节指针', () => {
  const first: ChapterRecord = {
    id: 'chapter-1',
    projectId: 'project-1',
    volumeId: 'volume-1',
    title: '第一章',
    order: 1,
    content: '<p>雨停后，她没有回头。</p>',
    wordCount: 10,
    revision: 1,
    createdAt: 1,
    updatedAt: 1,
  }
  const second: ChapterRecord = { ...first, id: 'chapter-2', title: '第二章', order: 2 }
  const third: ChapterRecord = {
    ...first,
    id: 'chapter-3',
    title: '第三章',
    order: 3,
    content: '<p>剑折了，她依然没有回头。</p>',
  }
  const hierarchy = [first, second, third]

  function makeAudit() {
    return vi.fn(async (_input: ContinuityAuditTaskInput): Promise<ContinuityFinding[]> => [])
  }

  function Harness({
    writingChapter,
    audit,
  }: {
    writingChapter: ChapterRecord
    audit: (input: ContinuityAuditTaskInput) => Promise<ContinuityFinding[] | null>
  }) {
    return (
      <ActiveWritingContextProvider workspaceId="project-1" initialChapter={writingChapter}>
        <CreativeWorkflowsPanel
          projectId="project-1"
          chapters={hierarchy}
          connected
          onContinuityAudit={audit}
          onDeepReasoning={vi.fn()}
          onDistillationWorkflow={vi.fn()}
          onSteerTask={vi.fn()}
        />
      </ActiveWritingContextProvider>
    )
  }

  it('把「审计当前章节」指向编辑器里正在写的章节，而不是层级里的第一章', async () => {
    const audit = makeAudit()
    render(<Harness writingChapter={third} audit={audit} />)

    expect(screen.getByRole('combobox', { name: '选择章节' })).toHaveAttribute(
      'data-value',
      'chapter-3',
    )
    fireEvent.click(screen.getByRole('button', { name: '审计当前章节' }))

    await waitFor(() => expect(audit).toHaveBeenCalledOnce())
    expect(audit.mock.calls[0][0].document.text).toContain('剑折了')
  })

  it('跟随编辑器翻页，直到作者自己改过章节下拉框', async () => {
    const audit = makeAudit()
    const { rerender } = render(<Harness writingChapter={first} audit={audit} />)
    expect(screen.getByRole('combobox', { name: '选择章节' })).toHaveAttribute(
      'data-value',
      'chapter-1',
    )

    rerender(<Harness writingChapter={second} audit={audit} />)
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: '选择章节' })).toHaveAttribute(
        'data-value',
        'chapter-2',
      ),
    )

    fireEvent.click(screen.getByRole('button', { name: '审计当前章节' }))
    await waitFor(() => expect(audit).toHaveBeenCalledOnce())
    expect(audit.mock.calls[0][0].document.text).toContain('她没有回头')
  })

  it('作者手动选定的章节不会被编辑器的翻页抢回去', async () => {
    const audit = makeAudit()
    const { rerender } = render(<Harness writingChapter={first} audit={audit} />)

    await userEvent.click(screen.getByRole('combobox', { name: '选择章节' }))
    await userEvent.click(await screen.findByRole('option', { name: '第三章' }))
    rerender(<Harness writingChapter={second} audit={audit} />)

    expect(screen.getByRole('combobox', { name: '选择章节' })).toHaveAttribute(
      'data-value',
      'chapter-3',
    )
    fireEvent.click(screen.getByRole('button', { name: '审计当前章节' }))
    await waitFor(() => expect(audit).toHaveBeenCalledOnce())
    expect(audit.mock.calls[0][0].document.text).toContain('剑折了')
  })
})
