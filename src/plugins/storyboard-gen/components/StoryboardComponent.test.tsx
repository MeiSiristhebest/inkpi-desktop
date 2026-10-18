import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StoryboardMasterView } from './StoryboardMasterView'
import { StoryboardDrawer } from './StoryboardDrawer'
import { DesktopPluginHostProvider } from '../../../core/pluginHostContext'
import { StoryboardEngine } from '../engine/StoryboardEngine'
import { indexedDbStoryboardRepository } from '../../../adapters/indexedDbStoryboardRepository'
import { clipboardWriter } from '../../../adapters/clipboardWriter'
import { blobFileDownloader } from '../../../adapters/blobFileDownloader'

vi.mock('../../../adapters/indexedDbStoryboardRepository', () => ({
  indexedDbStoryboardRepository: {
    getAll: vi.fn(async () => []),
    getByChapter: vi.fn(async () => []),
    get: vi.fn(async () => undefined),
    save: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
  },
}))

vi.mock('../../../adapters/clipboardWriter', () => ({
  clipboardWriter: { writeText: vi.fn(async () => undefined) },
}))

vi.mock('../../../adapters/blobFileDownloader', () => ({
  blobFileDownloader: { downloadBlob: vi.fn() },
}))

const completedWorkflow = (result: unknown) => ({
  status: 'completed',
  taskId: 'storyboard-task',
  pluginId: 'storyboard-gen',
  provenance: {
    pluginId: 'storyboard-gen',
    workspaceId: 'p1',
    taskId: 'storyboard-task',
    timestamp: 1,
  },
  result,
})

const sourceQuote = (text: string) =>
  screen.getAllByText(text).find((element) => element.tagName === 'BLOCKQUOTE')

describe('StoryboardGen UI Components', () => {
  beforeEach(() => {
    vi.mocked(indexedDbStoryboardRepository.getAll).mockResolvedValue([])
    vi.mocked(indexedDbStoryboardRepository.save).mockResolvedValue(undefined)
    vi.mocked(clipboardWriter.writeText).mockResolvedValue(undefined)
    vi.mocked(blobFileDownloader.downloadBlob).mockClear()
  })

  it('shows an empty state without inventing a scene or frames', () => {
    render(<StoryboardMasterView projectId="p1" />)

    expect(screen.getByText(/角色立绘与分镜生成器/)).toBeInTheDocument()
    expect(screen.getByText('没有场景正文，尚未生成镜头素材。')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '导出分镜与角色提示词' })).toBeDisabled()
  })

  it('uses the active chapter body and revision as the source', () => {
    render(
      <DesktopPluginHostProvider
        projectId="p1"
        activeChapter={{
          id: 'active-chapter',
          projectId: 'p1',
          volumeId: 'v1',
          title: '真实章节',
          content: '<p>真实章节正文</p>',
          wordCount: 6,
          order: 1,
          revision: 2,
          createdAt: 1,
          updatedAt: 1,
        }}
        isAiConnected={false}
      >
        <StoryboardMasterView projectId="p1" />
      </DesktopPluginHostProvider>,
    )

    expect(screen.getByLabelText('高潮名场面文本描述')).toHaveValue('真实章节正文')
    expect(screen.getByLabelText('高潮名场面文本描述')).toHaveAttribute('readonly')
    expect(screen.getByText(/版本 2/)).toBeInTheDocument()
    expect(sourceQuote('真实章节正文')).toBeInTheDocument()
  })

  it('sends a workflow only on click and accepts the result for the exact source', async () => {
    const text = '夜雨落在石桥上。'
    const expected = StoryboardEngine.extractStoryboard('manual', '桥上', text, {
      characters: [],
      artStyle: '',
      sceneGoal: '',
    })
    const onPluginWorkflow = vi.fn().mockResolvedValue(completedWorkflow(expected))

    render(
      <DesktopPluginHostProvider
        projectId="p1"
        activeChapter={null}
        onPluginWorkflow={onPluginWorkflow}
        isAiConnected
      >
        <StoryboardMasterView projectId="p1" />
      </DesktopPluginHostProvider>,
    )

    fireEvent.change(screen.getByLabelText('场景标题'), { target: { value: '桥上' } })
    fireEvent.change(screen.getByLabelText('高潮名场面文本描述'), { target: { value: text } })
    expect(onPluginWorkflow).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '构建 Runtime 分镜草案' }))

    await waitFor(() => expect(onPluginWorkflow).toHaveBeenCalledTimes(1))
    expect(onPluginWorkflow).toHaveBeenCalledWith(
      'storyboard-gen',
      expect.objectContaining({ chapterId: 'manual', chapterTitle: '桥上', chapterText: text }),
      expect.objectContaining({ projectId: 'p1', executionMode: 'explicit' }),
    )
    expect(await screen.findByRole('status')).toHaveTextContent('Runtime 分镜草案已构建。')
    expect(screen.getByRole('blockquote')).toHaveTextContent(text)
  })

  it('does not apply a delayed workflow result after the active chapter changes', async () => {
    let resolveWorkflow!: (value: unknown) => void
    const onPluginWorkflow = vi.fn(
      () =>
        new Promise<unknown>((resolve) => {
          resolveWorkflow = resolve
        }),
    )
    const firstChapter = {
      id: 'chapter-1',
      projectId: 'p1',
      volumeId: 'v1',
      title: '第一章',
      content: '<p>第一章正文</p>',
      wordCount: 6,
      order: 1,
      revision: 1,
      createdAt: 1,
      updatedAt: 1,
    }
    const secondChapter = {
      ...firstChapter,
      id: 'chapter-2',
      title: '第二章',
      content: '<p>第二章正文</p>',
      revision: 2,
    }
    const view = render(
      <DesktopPluginHostProvider
        projectId="p1"
        activeChapter={firstChapter}
        onPluginWorkflow={onPluginWorkflow}
        isAiConnected
      >
        <StoryboardMasterView projectId="p1" />
      </DesktopPluginHostProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: '构建 Runtime 分镜草案' }))
    await waitFor(() => expect(onPluginWorkflow).toHaveBeenCalledTimes(1))
    view.rerender(
      <DesktopPluginHostProvider
        projectId="p1"
        activeChapter={secondChapter}
        onPluginWorkflow={onPluginWorkflow}
        isAiConnected
      >
        <StoryboardMasterView projectId="p1" />
      </DesktopPluginHostProvider>,
    )

    resolveWorkflow(
      completedWorkflow(StoryboardEngine.extractStoryboard('chapter-1', '第一章', '第一章正文')),
    )

    expect(await screen.findByLabelText('高潮名场面文本描述')).toHaveValue('第二章正文')
    expect(sourceQuote('第二章正文')).toBeInTheDocument()
    expect(screen.queryByText('第一章正文')).not.toBeInTheDocument()
  })

  it('archives, copies, and exports a source-backed prompt with author constraints', async () => {
    const text = '旧书店里，林岚把门闩落下。'
    render(<StoryboardMasterView projectId="p1" />)

    fireEvent.change(screen.getByLabelText('场景标题'), { target: { value: '旧书店' } })
    fireEvent.change(screen.getByLabelText('高潮名场面文本描述'), { target: { value: text } })
    fireEvent.change(screen.getByLabelText('作者场景目标'), {
      target: { value: '确认门外来者身份' },
    })
    fireEvent.change(screen.getByLabelText('作者画风'), { target: { value: '黑白木刻' } })
    fireEvent.change(screen.getByLabelText('角色名称'), { target: { value: '林岚' } })
    fireEvent.change(screen.getByLabelText('角色外观约束'), {
      target: { value: '短发，深色外套' },
    })
    fireEvent.click(screen.getByRole('button', { name: '加入角色外观约束' }))

    expect(sourceQuote(text)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '归档本幕分镜草案' }))
    await waitFor(() => expect(indexedDbStoryboardRepository.save).toHaveBeenCalledTimes(1))
    expect(indexedDbStoryboardRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'p1',
        chapterId: 'manual',
        shotFrames: [expect.objectContaining({ sourceQuote: text })],
        characterCards: [
          expect.objectContaining({ characterName: '林岚', visualFeatures: '短发，深色外套' }),
        ],
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: '复制镜头提示词' }))
    await waitFor(() => expect(clipboardWriter.writeText).toHaveBeenCalledTimes(1))
    expect(clipboardWriter.writeText).toHaveBeenCalledWith(
      expect.stringContaining('短发，深色外套'),
    )

    fireEvent.click(screen.getByRole('button', { name: '导出分镜与角色提示词' }))
    const [filename, blob] = vi.mocked(blobFileDownloader.downloadBlob).mock.calls[0]
    expect(filename).toBe('分镜草案.md')
    expect(await (blob as Blob).text()).toContain(text)
    expect(await (blob as Blob).text()).toContain('黑白木刻')
  })

  it('drawer shows actual text positions and states that no image was generated', () => {
    const text = '林凡推开木门。'
    render(<StoryboardDrawer projectId="p1" currentText={text} />)

    expect(screen.getByText('1 个原文镜头素材')).toBeInTheDocument()
    expect(sourceQuote(text)).toBeInTheDocument()
    expect(screen.getByText(/图片尚未生成/)).toBeInTheDocument()
  })
})
