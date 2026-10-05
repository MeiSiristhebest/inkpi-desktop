import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { PressForgeMasterView } from './PressForgeMasterView'
import { PressForgeDrawer } from './PressForgeDrawer'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import { indexedDbPressConfigRepository } from '../../../adapters/indexedDbPressConfigRepository'
import { DesktopPluginHostProvider } from '../../../core/pluginHostContext'

vi.mock('../../../adapters/indexedDbProjectRepository', () => ({
  indexedDbProjectRepository: {
    getChaptersByProject: vi.fn(),
  },
}))

vi.mock('../../../adapters/indexedDbPressConfigRepository', () => ({
  indexedDbPressConfigRepository: {
    get: vi.fn(),
    save: vi.fn(),
  },
}))

describe('PressForge Components', () => {
  const fakeChapters = [
    {
      id: 'ch-1',
      projectId: 'proj-1',
      title: '第一章 启程',
      order: 1,
      content: '<p>测试段落一</p><p>测试段落二</p>',
    },
  ]

  it('renders PressForgeMasterView', async () => {
    vi.mocked(indexedDbProjectRepository.getChaptersByProject).mockResolvedValue(
      fakeChapters as any,
    )
    vi.mocked(indexedDbPressConfigRepository.get).mockResolvedValue(undefined)

    render(<PressForgeMasterView projectId="proj-1" />)
    expect(screen.getByText(/排版压制与多平台发布工坊/)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText(/目标发布平台预设/)).toBeInTheDocument()
      expect(screen.getByText(/一键复制格式化文本/)).toBeInTheDocument()
    })
  })

  it('renders PressForgeDrawer with formatting stats', async () => {
    render(<PressForgeDrawer projectId="proj-1" currentText="测试段落一\n测试段落二" />)
    expect(screen.getByText(/标准排版压制/)).toBeInTheDocument()
    expect(screen.getByText(/一键复制标准段首缩进正文/)).toBeInTheDocument()
  })

  it('does not put a model call behind the author typing: the AI run waits for a click', async () => {
    const onPluginTool = vi.fn(async () => null)
    vi.mocked(indexedDbProjectRepository.getChaptersByProject).mockResolvedValue(
      fakeChapters as any,
    )
    vi.mocked(indexedDbPressConfigRepository.get).mockResolvedValue(undefined)

    render(
      <DesktopPluginHostProvider
        projectId="proj-1"
        activeChapter={null}
        onPluginTool={onPluginTool}
        isAiConnected
      >
        <PressForgeMasterView projectId="proj-1" />
      </DesktopPluginHostProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('press-forge-ai-run')).toBeEnabled())
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(onPluginTool).not.toHaveBeenCalled()
    expect(screen.getByTestId('press-forge-result-origin')).toHaveTextContent('来源：本地排版引擎')
  })

  it('previews the local engine by default and names it as the source', async () => {
    vi.mocked(indexedDbProjectRepository.getChaptersByProject).mockResolvedValue(
      fakeChapters as any,
    )
    vi.mocked(indexedDbPressConfigRepository.get).mockResolvedValue(undefined)

    render(<PressForgeMasterView projectId="proj-1" />)
    await waitFor(() => expect(screen.getByTestId('press-forge-ai-run')).toBeEnabled())

    expect(screen.getByTestId('press-forge-result-origin')).toHaveTextContent('来源：本地排版引擎')
  })

  it('runs the Runtime tool only on an explicit click, and projects stored HTML at that boundary', async () => {
    const onPluginTool = vi.fn(async () => aiTypesetResult)
    vi.mocked(indexedDbProjectRepository.getChaptersByProject).mockResolvedValue(
      fakeChapters as any,
    )
    vi.mocked(indexedDbPressConfigRepository.get).mockResolvedValue(undefined)

    render(
      <DesktopPluginHostProvider
        projectId="proj-1"
        activeChapter={null}
        onPluginTool={onPluginTool}
        isAiConnected
      >
        <PressForgeMasterView projectId="proj-1" />
      </DesktopPluginHostProvider>,
    )

    fireEvent.click(await screen.findByTestId('press-forge-ai-run'))

    await waitFor(() => {
      expect(onPluginTool).toHaveBeenCalledTimes(1)
      expect(onPluginTool).toHaveBeenCalledWith(
        'press-forge',
        expect.objectContaining({ rawContent: '测试段落一\n测试段落二' }),
      )
    })
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('AI 深度排版后的正文'))
    expect(screen.getByTestId('press-forge-result-origin')).toHaveTextContent('来源：AI 深度排版')
  })

  it('drops the AI preview as soon as its own inputs change, instead of showing a stale result', async () => {
    const onPluginTool = vi.fn(async () => aiTypesetResult)
    vi.mocked(indexedDbProjectRepository.getChaptersByProject).mockResolvedValue(
      fakeChapters as any,
    )
    vi.mocked(indexedDbPressConfigRepository.get).mockResolvedValue(undefined)

    render(
      <DesktopPluginHostProvider
        projectId="proj-1"
        activeChapter={null}
        onPluginTool={onPluginTool}
        isAiConnected
      >
        <PressForgeMasterView projectId="proj-1" />
      </DesktopPluginHostProvider>,
    )

    fireEvent.click(await screen.findByTestId('press-forge-ai-run'))
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('AI 深度排版后的正文'))

    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '0' } })

    expect(screen.getByRole('textbox')).not.toHaveValue('AI 深度排版后的正文')
    expect(screen.getByTestId('press-forge-result-origin')).toHaveTextContent('来源：本地排版引擎')
    expect(screen.queryByRole('button', { name: /回到本地排版/ })).not.toBeInTheDocument()
    expect(onPluginTool).toHaveBeenCalledTimes(1)
  })

  it('reports an unavailable AI channel instead of a silent no-op', async () => {
    vi.mocked(indexedDbProjectRepository.getChaptersByProject).mockResolvedValue(
      fakeChapters as any,
    )
    vi.mocked(indexedDbPressConfigRepository.get).mockResolvedValue(undefined)

    render(
      <DesktopPluginHostProvider projectId="proj-1" activeChapter={null} isAiConnected={false}>
        <PressForgeMasterView projectId="proj-1" />
      </DesktopPluginHostProvider>,
    )

    fireEvent.click(await screen.findByTestId('press-forge-ai-run'))

    expect(await screen.findByRole('alert')).toHaveTextContent('AI 通道不可用，深度排版没有发出')
    expect(screen.getByTestId('press-forge-result-origin')).toHaveTextContent('来源：本地排版引擎')
  })
})

const aiTypesetResult = {
  formattedText: 'AI 深度排版后的正文',
  lineCount: 1,
  characterCount: 10,
  fixedPunctuationCount: 0,
  warnings: [],
}
