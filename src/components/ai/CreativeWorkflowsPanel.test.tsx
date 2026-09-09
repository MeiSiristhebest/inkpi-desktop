import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ChapterRecord } from '../../types'
import { chapterSaveEvents } from '../../ports/chapterSaveEvents'
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
  it('runs continuity audit from the UI with canonical plain-text input', async () => {
    let auditedBlockId = ''
    const audit = vi.fn(async (input: { document: { text: string; blocks: Array<{ id: string }> } }) => {
      expect(input.document.text).toBe('雨停后，她没有回头。')
      auditedBlockId = input.document.blocks[0].id
      return [{ id: 'finding-1', severity: 'warning' as const, description: '存在未回收伏笔', blockIds: [input.document.blocks[0].id] }]
    })
    render(<CreativeWorkflowsPanel projectId="project-1" chapters={[chapter]} connected onContinuityAudit={audit} onDeepReasoning={vi.fn()} onDistillationWorkflow={vi.fn()} onSteerTask={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: '审计当前章节' }))
    await waitFor(() => expect(screen.getByTestId('continuity-findings')).toHaveTextContent('存在未回收伏笔'))
    expect(screen.getByTestId('continuity-diagnostic')).toHaveAttribute('data-location-kind', 'located')
    expect(screen.getByTestId('continuity-diagnostic-location')).toHaveAttribute('data-block-id', auditedBlockId)
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
    let resolveReasoning!: (value: { answer: string; assumptions: string[]; alternatives: string[]; risks: string[] }) => void
    const reasoning = vi.fn((_input: unknown, options?: { onProgress?: (snapshot: { taskId: string; kind: string; status: 'running' }) => void }) => {
      options?.onProgress?.({ taskId: 'deep-task', kind: 'narrative.deep.reason', status: 'running' })
      return new Promise<{ answer: string; assumptions: string[]; alternatives: string[]; risks: string[] }>((resolve) => { resolveReasoning = resolve })
    })
    const steer = vi.fn(async () => true)
    render(<CreativeWorkflowsPanel projectId="project-1" chapters={[chapter]} connected onContinuityAudit={vi.fn()} onDeepReasoning={reasoning} onDistillationWorkflow={vi.fn()} onSteerTask={steer} />)

    fireEvent.click(screen.getByRole('button', { name: '深度推理' }))
    fireEvent.click(screen.getByRole('button', { name: '开始深度推理' }))
    await waitFor(() => expect(reasoning).toHaveBeenCalledOnce())
    fireEvent.change(screen.getByLabelText('推理 steering'), { target: { value: '保持冷色意象' } })
    fireEvent.click(screen.getByRole('button', { name: '引导' }))
    await waitFor(() => expect(steer).toHaveBeenCalledWith(expect.any(String), { direction: '保持冷色意象' }))
    resolveReasoning({ answer: '保留冷色意象', assumptions: [], alternatives: [], risks: [] })
    await waitFor(() => expect(screen.getByTestId('deep-reasoning-result')).toHaveTextContent('保留冷色意象'))
  })

  it('cancels a running deep reasoning task through its AbortSignal', async () => {
    const reasoning = vi.fn((_input: unknown, options?: { signal?: AbortSignal }) =>
      new Promise<never>((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })
      }))
    render(<CreativeWorkflowsPanel projectId="project-1" chapters={[chapter]} connected onContinuityAudit={vi.fn()} onDeepReasoning={reasoning} onDistillationWorkflow={vi.fn()} onSteerTask={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: '深度推理' }))
    fireEvent.click(screen.getByRole('button', { name: '开始深度推理' }))
    await waitFor(() => expect(reasoning).toHaveBeenCalledOnce())
    expect(reasoning.mock.calls[0][1]?.signal?.aborted).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: '取消深度推理' }))
    await waitFor(() => expect(screen.getByRole('button', { name: '开始深度推理' })).toBeEnabled())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows a human-intervention state reported by the Runtime', async () => {
    let resolveReasoning!: (value: { answer: string; assumptions: string[]; alternatives: string[]; risks: string[] }) => void
    const reasoning = vi.fn((_input: unknown, options?: { onProgress?: (snapshot: { taskId: string; kind: string; status: 'waiting-user' }) => void }) => {
      options?.onProgress?.({ taskId: 'deep-waiting', kind: 'narrative.deep.reason', status: 'waiting-user' })
      return new Promise<{ answer: string; assumptions: string[]; alternatives: string[]; risks: string[] }>((resolve) => { resolveReasoning = resolve })
    })
    render(<CreativeWorkflowsPanel projectId="project-1" chapters={[chapter]} connected onContinuityAudit={vi.fn()} onDeepReasoning={reasoning} onDistillationWorkflow={vi.fn()} onSteerTask={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: '深度推理' }))
    fireEvent.click(screen.getByRole('button', { name: '开始深度推理' }))
    await waitFor(() => expect(screen.getByTestId('workflow-waiting-user')).toHaveTextContent('等待人工输入'))
    resolveReasoning({ answer: '继续', assumptions: [], alternatives: [], risks: [] })
    await waitFor(() => expect(screen.getByTestId('deep-reasoning-result')).toHaveTextContent('继续'))
  })

  it('runs project distillation with a resumable checkpoint', async () => {
    const distill = vi.fn(async (_input: unknown, options: { onProgress?: (progress: { completedChunks: number; totalChunks: number; failedChunks: string[] }) => void; checkpoint?: unknown }) => {
      options.onProgress?.({ completedChunks: 1, totalChunks: 1, failedChunks: [] })
      return {
        facts: { summary: '项目提炼完成', entities: [], events: [], promises: [] },
        complete: true,
        failedChunks: [],
        completedChunks: 1,
        totalChunks: 1,
        checkpoint: { nextChunk: 1, completedChunkIndexes: [0], failedChunkIndexes: [], failedChunks: [], facts: { summary: '项目提炼完成', entities: [], events: [], promises: [] } },
        chunkTaskIds: ['project-distillation:chunk:0'],
      }
    })
    render(<CreativeWorkflowsPanel projectId="project-1" chapters={[chapter]} connected onContinuityAudit={vi.fn()} onDeepReasoning={vi.fn()} onDistillationWorkflow={distill} onSteerTask={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: '项目提炼' }))
    fireEvent.click(screen.getByRole('button', { name: '开始项目提炼' }))
    await waitFor(() => expect(screen.getByTestId('distillation-result')).toHaveTextContent('项目提炼完成'))
    expect(distill).toHaveBeenCalledWith(expect.objectContaining({ documents: [expect.objectContaining({ text: '雨停后，她没有回头。' })] }), expect.objectContaining({ checkpoint: undefined }))
  })
})
