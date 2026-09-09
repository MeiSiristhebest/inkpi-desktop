import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ChapterRecord } from '../../types'
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
    const audit = vi.fn(async (input: { input: { text: string } }) => {
      expect(input.input.text).toBe('雨停后，她没有回头。')
      return [{ id: 'finding-1', severity: 'warning' as const, description: '存在未回收伏笔' }]
    })
    render(<CreativeWorkflowsPanel chapters={[chapter]} connected onContinuityAudit={audit} onDeepReasoning={vi.fn()} onDistillationWorkflow={vi.fn()} onSteerTask={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: '审计当前章节' }))
    await waitFor(() => expect(screen.getByTestId('continuity-findings')).toHaveTextContent('存在未回收伏笔'))
    expect(audit).toHaveBeenCalledOnce()
  })

  it('runs deep reasoning and forwards interactive steering while the task is pending', async () => {
    let resolveReasoning!: (value: { answer: string; assumptions: string[]; alternatives: string[]; risks: string[] }) => void
    const reasoning = vi.fn((_input: unknown, options?: { onProgress?: (snapshot: { taskId: string; kind: string; status: 'running' }) => void }) => {
      options?.onProgress?.({ taskId: 'deep-task', kind: 'narrative.deep.reason', status: 'running' })
      return new Promise<{ answer: string; assumptions: string[]; alternatives: string[]; risks: string[] }>((resolve) => { resolveReasoning = resolve })
    })
    const steer = vi.fn(async () => true)
    render(<CreativeWorkflowsPanel chapters={[chapter]} connected onContinuityAudit={vi.fn()} onDeepReasoning={reasoning} onDistillationWorkflow={vi.fn()} onSteerTask={steer} />)

    fireEvent.click(screen.getByRole('button', { name: '深度推理' }))
    fireEvent.click(screen.getByRole('button', { name: '开始深度推理' }))
    await waitFor(() => expect(reasoning).toHaveBeenCalledOnce())
    fireEvent.change(screen.getByLabelText('推理 steering'), { target: { value: '保持冷色意象' } })
    fireEvent.click(screen.getByRole('button', { name: '引导' }))
    await waitFor(() => expect(steer).toHaveBeenCalledWith(expect.any(String), { direction: '保持冷色意象' }))
    resolveReasoning({ answer: '保留冷色意象', assumptions: [], alternatives: [], risks: [] })
    await waitFor(() => expect(screen.getByTestId('deep-reasoning-result')).toHaveTextContent('保留冷色意象'))
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
    render(<CreativeWorkflowsPanel chapters={[chapter]} connected onContinuityAudit={vi.fn()} onDeepReasoning={vi.fn()} onDistillationWorkflow={distill} onSteerTask={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: '项目提炼' }))
    fireEvent.click(screen.getByRole('button', { name: '开始项目提炼' }))
    await waitFor(() => expect(screen.getByTestId('distillation-result')).toHaveTextContent('项目提炼完成'))
    expect(distill).toHaveBeenCalledWith(expect.objectContaining({ documents: [expect.objectContaining({ text: '雨停后，她没有回头。' })] }), expect.objectContaining({ checkpoint: undefined }))
  })
})
