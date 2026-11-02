import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { AiTask } from '@inkpi/protocol'
import { ReaderHookMasterView } from './ReaderHookMasterView'
import { indexedDbReaderHookRepository as repo } from '../../../adapters/indexedDbReaderHookRepository'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import { DesktopPluginHostProvider } from '../../../core/pluginHostContext'
vi.mock('../../../adapters/indexedDbReaderHookRepository', () => ({
  indexedDbReaderHookRepository: {
    getAll: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}))
vi.mock('../../../adapters/indexedDbProjectRepository', () => ({
  indexedDbProjectRepository: {
    getChaptersByProject: vi.fn().mockResolvedValue([]),
    getVolumesByProject: vi.fn().mockResolvedValue([]),
  },
}))
describe('ReaderHookMasterView', () => {
  beforeEach(() => vi.clearAllMocks())
  it('starts without fabricated sample text', () => {
    render(<ReaderHookMasterView projectId="p" />)
    expect(screen.getByLabelText('待审章节正文')).toHaveValue('')
    expect(screen.getByRole('button', { name: '入库本章断章' })).toBeDisabled()
  })
  it('preserves source and exposes failed save before retry', async () => {
    vi.mocked(repo.save).mockRejectedValueOnce(new Error('storage failed'))
    render(<ReaderHookMasterView projectId="p" />)
    const text = screen.getByLabelText('待审章节正文')
    fireEvent.change(text, { target: { value: '😀她没有倒计时。' } })
    fireEvent.click(screen.getByRole('button', { name: '入库本章断章' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('storage failed'))
    expect(text).toHaveValue('😀她没有倒计时。')
    fireEvent.click(screen.getByRole('button', { name: '入库本章断章' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('已保存'))
    expect(repo.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        projectId: 'p',
        hookText: '😀她没有倒计时。',
        hookType: 'unclassified',
      }),
    )
    expect(vi.mocked(repo.save).mock.calls.at(-1)![0]).not.toHaveProperty('tensionScore')
    expect(vi.mocked(repo.save).mock.calls.at(-1)![0]).toMatchObject({ sourceKind: 'manual' })
  })

  it('keeps edited chapter text distinct from its saved source revision', async () => {
    const chapter = {
      id: 'chapter-1',
      projectId: 'p',
      volumeId: 'volume-1',
      title: '第一章',
      content: '<p>保存版本正文。</p>',
      wordCount: 7,
      order: 1,
      revision: 7,
      createdAt: 1,
      updatedAt: 1,
    }
    vi.mocked(indexedDbProjectRepository.getChaptersByProject).mockResolvedValue([chapter] as any)
    vi.mocked(indexedDbProjectRepository.getVolumesByProject).mockResolvedValue([
      { id: 'volume-1', projectId: 'p', title: '第一卷', order: 1 },
    ] as any)
    const onAiTask = vi.fn(async (task: AiTask) => ({
      taskId: task.id,
      kind: task.kind,
      status: 'completed' as const,
      output: { format: 'text' as const, text: '审阅完成' },
    }))

    render(
      <DesktopPluginHostProvider
        projectId="p"
        activeChapter={null}
        chapters={[chapter]}
        isAiConnected
        onAiTask={onAiTask}
      >
        <ReaderHookMasterView projectId="p" />
      </DesktopPluginHostProvider>,
    )

    const text = await screen.findByRole('textbox', { name: '待审章节正文' })
    expect(text).toHaveValue('保存版本正文。')
    fireEvent.change(text, { target: { value: '编辑副本正文。' } })
    fireEvent.click(screen.getByRole('button', { name: 'AI 深度审读' }))

    await waitFor(() => expect(onAiTask).toHaveBeenCalledTimes(1))
    expect(onAiTask.mock.calls[0]?.[0]).toMatchObject({
      scope: { document: { id: 'chapter-1', revision: 7 } },
      metadata: { sourceKind: 'edited-copy' },
    })

    fireEvent.click(screen.getByRole('button', { name: '入库本章断章' }))
    await waitFor(() => expect(repo.save).toHaveBeenCalled())
    expect(repo.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        chapterId: 'chapter-1',
        sourceRevision: 7,
        sourceKind: 'edited-copy',
        hookText: '编辑副本正文。',
      }),
    )
  })
})
