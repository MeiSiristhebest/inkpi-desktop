import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { StoryboardMasterView } from './StoryboardMasterView'
import { StoryboardDrawer } from './StoryboardDrawer'
import { DesktopPluginHostProvider } from '../../../core/pluginHostContext'

describe('StoryboardGen UI Components', () => {
  it('StoryboardMasterView renders correctly', () => {
    render(<StoryboardMasterView projectId="p1" />)
    expect(screen.getByText(/角色立绘与分镜生成器/)).toBeDefined()
    expect(screen.getByText(/电影视听“起承转合”四格高潮分镜提炼/)).toBeDefined()
  })

  it('initializes from the active chapter instead of hidden sample content', () => {
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

    expect(screen.getByLabelText('对应章节ID')).toHaveValue('active-chapter')
    expect(screen.getByLabelText('高潮名场面文本描述')).toHaveValue('真实章节正文')
  })

  it('does not invoke the Runtime workflow until the author explicitly runs it', async () => {
    const onPluginWorkflow = vi.fn().mockResolvedValue(null)
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

    expect(onPluginWorkflow).not.toHaveBeenCalled()
    fireEvent.change(screen.getByPlaceholderText('对应章节ID'), { target: { value: 'chapter-7' } })
    fireEvent.change(screen.getAllByRole('textbox')[1], {
      target: { value: '夜雨中的两名角色在桥上对峙。' },
    })
    fireEvent.click(screen.getByRole('button', { name: '运行 AI 分镜' }))

    await waitFor(() => expect(onPluginWorkflow).toHaveBeenCalledTimes(1))
    expect(onPluginWorkflow).toHaveBeenCalledWith(
      'storyboard-gen',
      expect.objectContaining({ chapterId: 'chapter-7' }),
      expect.objectContaining({ executionMode: 'explicit', cancellable: true }),
    )
  })

  it('ignores a workflow result after the active chapter changes', async () => {
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

    fireEvent.click(screen.getByRole('button', { name: '运行 AI 分镜' }))
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
    expect(screen.getByLabelText('对应章节ID')).toHaveValue('chapter-2')
    expect(screen.getByLabelText('高潮名场面文本描述')).toHaveValue('第二章正文')
    resolveWorkflow({
      status: 'completed',
      taskId: 'stale-workflow',
      pluginId: 'storyboard-gen',
      provenance: {
        pluginId: 'storyboard-gen',
        workspaceId: 'p1',
        taskId: 'stale-workflow',
        timestamp: 1,
      },
      result: {
        sceneTitle: '过期结果',
        coreConflict: '过期冲突',
        frames: [
          {
            id: 'stale-frame',
            shotLabel: '过期镜头',
            shotType: 'wide',
            description: '过期描述',
            visualPrompt: 'stale-prompt',
            compositionGuide: 'rule_of_thirds',
            lightingMood: 'dark',
          },
        ],
        suggestedCharacters: [],
      },
    })

    await waitFor(() => expect(screen.queryByText('stale-prompt')).not.toBeInTheDocument())
  })

  it('StoryboardDrawer renders correctly with text preview', () => {
    render(
      <StoryboardDrawer
        projectId="p1"
        currentText="林凡眼神冰冷，握紧手中的断剑，周围剑气如龙卷般肆虐！"
      />,
    )
    expect(screen.getByText(/名场面四格分镜/)).toBeDefined()
    expect(screen.getByText(/镜头就绪/)).toBeDefined()
  })
})
