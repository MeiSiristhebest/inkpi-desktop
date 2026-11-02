import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiTask, TaskResult } from '@inkpi/protocol'
import { DesktopPluginHostProvider } from '../../../core/pluginHostContext'
import type { ChapterRecord } from '../../../types'
import type { GroundedPluginInput } from '../../../domain/pluginAnalysis'
import { indexedDbReaderSimulationRepository } from '../../../adapters/indexedDbReaderSimulationRepository'
import { ReaderSimulatorMasterView } from './ReaderSimulatorMasterView'
import { ShadowReaderMasterView } from '../../shadow-reader/components/ShadowReaderMasterView'

const text = '她没有跪下，而是抵抗命令。'
const chapter: ChapterRecord = {
  id: 'c1',
  projectId: 'p1',
  volumeId: 'v1',
  title: '合成片段',
  content: text,
  wordCount: text.length,
  order: 0,
  revision: 1,
  createdAt: 1,
  updatedAt: 1,
}
vi.mock('../../../adapters/indexedDbProjectRepository', () => ({
  indexedDbProjectRepository: {
    getChaptersByProject: vi.fn(async () => [
      {
        id: 'c1',
        projectId: 'p1',
        volumeId: 'v1',
        title: '合成片段',
        content: '她没有跪下，而是抵抗命令。',
        order: 0,
        revision: 1,
      },
    ]),
    getVolumesByProject: vi.fn(async () => [
      { id: 'v1', projectId: 'p1', title: '第一卷', order: 0 },
    ]),
  },
}))
vi.mock('../../../adapters/indexedDbReaderSimulationRepository', () => ({
  indexedDbReaderSimulationRepository: {
    save: vi.fn(async () => {}),
    getAll: vi.fn(async () => []),
  },
}))
vi.mock('../../../adapters/indexedDbShadowReaderRepository', () => ({
  indexedDbShadowReaderRepository: { save: vi.fn(async () => {}), getAll: vi.fn(async () => []) },
}))

function response(task: AiTask, forged = false): TaskResult {
  const input = task.input.payload?.analysisInput as GroundedPluginInput
  const source = input.sources.find((s) => s.label === 'text' || s.label === 'chapterText')!
  expect(source.text).toBe(text)
  expect(task.metadata?.instructionVersion).toBe('2')
  return {
    taskId: task.id,
    status: 'completed',
    output: {
      format: 'text',
      text: JSON.stringify({
        findings: [
          {
            aspect: input.rubric[0],
            observation: '角色拒绝下跪',
            interpretation: '该选择可能表达反抗，仍需上下文',
            recommendation: '',
            evidence: [
              {
                sourceId: source.id,
                start: 0,
                end: text.length,
                quote: forged ? '她跪下了。' : text,
              },
            ],
          },
        ],
        insufficientEvidence: ['没有前文和真实读者反馈'],
      }),
    },
  }
}

beforeEach(() => vi.clearAllMocks())
describe('reader analysis through the real host', () => {
  it('saves source questions without scores or votes and exposes a failed save', async () => {
    render(<ReaderSimulatorMasterView projectId="p1" />)
    await waitFor(() => expect(screen.getByRole('button', { name: '保存复核问题' })).toBeEnabled())
    expect(screen.queryByText(/毒点风险指数|考据逻辑严密度|爽点满足感/)).not.toBeInTheDocument()
    const save = vi.mocked(indexedDbReaderSimulationRepository.save)
    save.mockRejectedValueOnce(new Error('storage unavailable'))
    fireEvent.click(screen.getByRole('button', { name: '保存复核问题' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('storage unavailable'))
    const record = save.mock.calls[0][0]
    expect(record).toMatchObject({
      chapterId: 'c1',
      comments: [
        {
          sentiment: 'review_question',
          targetSnippet: text,
          sourceStart: 0,
          sourceEnd: text.length,
        },
      ],
    })
    expect(record).not.toHaveProperty('toxicityScore')
    expect(record.comments[0]).not.toHaveProperty('upvotes')
    fireEvent.click(screen.getByRole('button', { name: '保存复核问题' }))
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  it('validates a reader profile interpretation and preserves saved-chapter provenance', async () => {
    const run = vi.fn(async (task: AiTask) => response(task))
    render(
      <DesktopPluginHostProvider
        projectId="p1"
        activeChapter={chapter}
        isAiConnected
        onAiTask={run}
      >
        <ReaderSimulatorMasterView projectId="p1" />
      </DesktopPluginHostProvider>,
    )
    await waitFor(() => expect(screen.getByRole('button', { name: '保存复核问题' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'AI 假设读者段评模拟' }))
    await waitFor(() =>
      expect(screen.getByLabelText('AI 任务结果')).toHaveTextContent(`「${text}」`),
    )
    expect(screen.getByLabelText('AI 任务结果')).toHaveTextContent('模型解释：')
    expect(run.mock.calls[0]?.[0]).toMatchObject({
      scope: { document: { id: 'c1', revision: 1 } },
      metadata: { sourceKind: 'saved-chapter' },
    })
  })

  it('rejects fabricated shadow-reader evidence and invalidates edits before retry', async () => {
    const run = vi.fn(async (task: AiTask) => response(task, true))
    await act(async () => {
      render(
        <DesktopPluginHostProvider
          projectId="p1"
          activeChapter={chapter}
          isAiConnected
          onAiTask={run}
        >
          <ShadowReaderMasterView projectId="p1" />
        </DesktopPluginHostProvider>,
      )
    })
    fireEvent.click(screen.getByRole('button', { name: 'AI 阅读顺序复核' }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('引用与所提交原文不一致'),
    )
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '她离开了。' } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '重试' })).not.toBeInTheDocument()
    expect(run).toHaveBeenCalledTimes(1)
  })
})
