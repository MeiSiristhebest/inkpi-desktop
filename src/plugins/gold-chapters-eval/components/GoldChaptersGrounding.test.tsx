import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiTask, TaskResult } from '@inkpi/protocol'
import { DesktopPluginHostProvider } from '../../../core/pluginHostContext'
import { indexedDbGoldChaptersRepository } from '../../../adapters/indexedDbGoldChaptersRepository'
import { GoldChaptersMasterView } from './GoldChaptersMasterView'
import { GoldChaptersEngine } from '../engine/GoldChaptersEngine'

vi.mock('../../../adapters/indexedDbGoldChaptersRepository', () => ({
  indexedDbGoldChaptersRepository: { getAll: vi.fn(async () => []), save: vi.fn(async () => {}) },
}))
vi.mock('../../../adapters/indexedDbProjectRepository', () => ({
  indexedDbProjectRepository: {
    getChaptersByProject: vi.fn(async () => []),
    getVolumesByProject: vi.fn(async () => []),
  },
}))

const text = '她要把失散的孩子带回家。'
type Input = ReturnType<typeof GoldChaptersEngine.buildAnalysisInput>
const review = (quote: string = text) =>
  JSON.stringify({
    findings: [
      {
        dimension: 'motivation',
        observation: '角色有寻找孩子的目标',
        interpretation: '这是可能的行动动机',
        recommendation: '可保留此目标',
        evidence: [{ sourceId: 'excerpt-0', start: 0, end: text.length, quote }],
      },
    ],
    insufficientEvidence: [],
  })

function tree(onAiTask: (task: AiTask) => Promise<TaskResult | null>, projectId = 'p1') {
  return (
    <DesktopPluginHostProvider projectId={projectId} onAiTask={onAiTask} isAiConnected>
      <GoldChaptersMasterView projectId={projectId} />
    </DesktopPluginHostProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('opening review end to end at the host boundary', () => {
  it('validates the actual task response, invalidates edits, and hides another project result', async () => {
    const onAiTask = vi.fn(async (task: AiTask): Promise<TaskResult> => {
      const input = task.input.payload?.analysisInput as Input
      expect(input.sources[0].text).toBe(text)
      expect(task.metadata?.instructionVersion).toBe('2')
      return { taskId: task.id, status: 'completed', output: { format: 'text', text: review() } }
    })
    let view!: ReturnType<typeof render>
    await act(async () => {
      view = render(tree(onAiTask))
    })
    const editor = screen.getByRole('textbox')
    fireEvent.change(editor, { target: { value: text } })
    fireEvent.click(screen.getByRole('button', { name: 'AI 开篇点评' }))
    await waitFor(() =>
      expect(screen.getByLabelText('AI 任务结果')).toHaveTextContent(`「${text}」`),
    )
    expect(screen.getByLabelText('AI 任务结果')).toHaveTextContent('模型解释：')
    fireEvent.change(editor, { target: { value: text + '她改了主意。' } })
    expect(screen.getByRole('alert')).toHaveTextContent('分析后正文已变化')
    expect(screen.queryByLabelText('AI 任务结果')).not.toBeInTheDocument()
    await act(async () => {
      view.rerender(tree(onAiTask, 'p2'))
    })
    expect(screen.queryByLabelText('AI 任务结果')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveValue('')
  })

  it('does not present a completed model call with invented evidence as a usable review', async () => {
    const onAiTask = async (task: AiTask): Promise<TaskResult> => ({
      taskId: task.id,
      status: 'completed',
      output: { format: 'text', text: review('她要复仇。') },
    })
    await act(async () => {
      render(tree(onAiTask))
    })
    fireEvent.change(screen.getByRole('textbox'), { target: { value: text } })
    fireEvent.click(screen.getByRole('button', { name: 'AI 开篇点评' }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('引用与所提交原文不一致'),
    )
    expect(screen.queryByLabelText('AI 任务结果')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '重试' })).toBeEnabled()
  })

  it('saves evidence instead of scores and exposes storage failure', async () => {
    await act(async () => {
      render(<GoldChaptersMasterView projectId="p1" />)
    })
    expect(screen.getByRole('button', { name: '保存文本线索快照' })).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: text } })
    const save = vi.mocked(indexedDbGoldChaptersRepository.save)
    save.mockRejectedValueOnce(new Error('storage unavailable'))
    fireEvent.click(screen.getByRole('button', { name: '保存文本线索快照' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('storage unavailable'))
    const record = save.mock.calls[0][0]
    expect(record).toMatchObject({ projectId: 'p1', observationSnapshot: { status: 'no-matches' } })
    expect(record).not.toHaveProperty('score')
    expect(record).not.toHaveProperty('isQualified')
    fireEvent.click(screen.getByRole('button', { name: '保存文本线索快照' }))
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })
})
