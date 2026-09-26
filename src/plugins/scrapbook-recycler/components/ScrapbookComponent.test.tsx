import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ScrapbookMasterView } from './ScrapbookMasterView'
import { ScrapbookDrawer } from './ScrapbookDrawer'
import { indexedDbScrapbookRepository } from '../../../adapters/indexedDbScrapbookRepository'
import { DesktopPluginHostProvider } from '../../../core/pluginHostContext'
import type { ScrapbookFragmentRecord } from '../types'

vi.mock('../../../adapters/indexedDbScrapbookRepository', () => ({
  indexedDbScrapbookRepository: {
    getAll: vi.fn(),
    get: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  },
}))

const FRAG_A = '林凡走在大街上，风很大。'
const FRAG_B = '林凡回头看了一眼城楼。'

function fragment(id: string, snippet: string, deletedAt: number): ScrapbookFragmentRecord {
  return {
    id,
    projectId: 'p1',
    sourceChapterTitle: '第一章 启程',
    snippet,
    wordCount: 12,
    deletedAt,
    tags: ['废稿'],
    isReused: false,
  }
}

/** 卡片正文按 deletedAt 倒序是 frag-a 在前；AI 重排会把它换到 frag-b 在前。 */
const snippetCards = () => screen.getAllByText(new RegExp(`(${FRAG_A}|${FRAG_B})`))

/** 切片清单是异步读出来的；在它落地之前点 AI 按钮，请求里就还是空语料。 */
const loadedCorpus = async () => {
  await waitFor(() => expect(snippetCards()).toHaveLength(2))
}

function renderWithRuntimeTool(
  onPluginTool: (pluginId: string, input: Record<string, unknown>) => Promise<unknown>,
) {
  render(
    <DesktopPluginHostProvider
      projectId="p1"
      activeChapter={null}
      onPluginTool={onPluginTool as any}
      isAiConnected
    >
      <ScrapbookMasterView projectId="p1" />
    </DesktopPluginHostProvider>,
  )
}

const aiRanked = [
  { fragment: fragment('frag-b', FRAG_B, 200), similarityScore: 0.9, matchedKeywords: ['林凡'] },
  { fragment: fragment('frag-a', FRAG_A, 300), similarityScore: 0.4, matchedKeywords: ['林凡'] },
]

describe('ScrapbookRecycler UI Components', () => {
  beforeEach(() => {
    vi.mocked(indexedDbScrapbookRepository.getAll).mockResolvedValue([
      fragment('frag-a', FRAG_A, 300),
      fragment('frag-b', FRAG_B, 200),
    ])
  })

  it('ScrapbookMasterView renders correctly', async () => {
    render(<ScrapbookMasterView projectId="p1" />)
    expect(screen.getByText(/废稿灵感碎纸机回收站/)).toBeDefined()
    await waitFor(() => expect(snippetCards()).toHaveLength(2))
  })

  it('ScrapbookDrawer renders correctly', () => {
    render(<ScrapbookDrawer projectId="p1" currentText="林凡走在大街上。" />)
    expect(screen.getByText(/废稿灵感推荐/)).toBeDefined()
  })

  it('types a search query without spending a model call (§P2.7)', async () => {
    const onPluginTool = vi.fn(async () => aiRanked)
    renderWithRuntimeTool(onPluginTool)
    await loadedCorpus()

    const search = screen.getByPlaceholderText(/搜索废稿内容/)
    fireEvent.change(search, { target: { value: '林' } })
    fireEvent.change(search, { target: { value: '林凡' } })
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(onPluginTool).not.toHaveBeenCalled()
    expect(screen.getByTestId('scrapbook-result-origin')).toHaveTextContent(
      '排序来源：本地关键词匹配',
    )
  })

  it('reorders the local matches only on the explicit AI run, at the projected boundary', async () => {
    const onPluginTool = vi.fn(async () => aiRanked)
    renderWithRuntimeTool(onPluginTool)
    await loadedCorpus()

    fireEvent.change(screen.getByPlaceholderText(/搜索废稿内容/), { target: { value: '林凡' } })
    fireEvent.click(screen.getByTestId('scrapbook-ai-run'))

    await waitFor(() => expect(onPluginTool).toHaveBeenCalledTimes(1))
    expect(onPluginTool).toHaveBeenCalledWith(
      'scrapbook-recycler',
      expect.objectContaining({
        contextText: '林凡',
        topK: 2,
        fragments: expect.arrayContaining([
          expect.objectContaining({ id: 'frag-a', snippet: FRAG_A }),
        ]),
      }),
    )
    await waitFor(() => expect(snippetCards()[0]).toHaveTextContent('城楼'))
    expect(screen.getByTestId('scrapbook-result-origin')).toHaveTextContent(
      '排序来源：AI 语义重排（对「林凡」的本次显式运行）',
    )
  })

  it('drops an AI ordering once its query changes, without issuing a second call', async () => {
    const onPluginTool = vi.fn(async () => aiRanked)
    renderWithRuntimeTool(onPluginTool)
    await loadedCorpus()

    const search = screen.getByPlaceholderText(/搜索废稿内容/)
    fireEvent.change(search, { target: { value: '林' } })
    fireEvent.click(screen.getByTestId('scrapbook-ai-run'))
    await waitFor(() => expect(snippetCards()[0]).toHaveTextContent('城楼'))

    fireEvent.change(search, { target: { value: '林凡' } })

    expect(screen.getByTestId('scrapbook-result-origin')).toHaveTextContent(
      '排序来源：本地关键词匹配',
    )
    expect(snippetCards()[0]).toHaveTextContent('大街上')
    expect(screen.queryByRole('button', { name: /回到本地匹配顺序/ })).not.toBeInTheDocument()
    expect(onPluginTool).toHaveBeenCalledTimes(1)
  })

  it('reports an unavailable AI channel instead of a silent no-op', async () => {
    const onPluginTool = vi.fn(async () => aiRanked)
    render(
      <DesktopPluginHostProvider
        projectId="p1"
        activeChapter={null}
        onPluginTool={onPluginTool as any}
        isAiConnected={false}
      >
        <ScrapbookMasterView projectId="p1" />
      </DesktopPluginHostProvider>,
    )
    await screen.findByTestId('scrapbook-ai-run')

    fireEvent.change(screen.getByPlaceholderText(/搜索废稿内容/), { target: { value: '林凡' } })
    fireEvent.click(screen.getByTestId('scrapbook-ai-run'))

    expect(await screen.findByRole('alert')).toHaveTextContent('AI 通道不可用，语义排序没有发出')
    expect(onPluginTool).not.toHaveBeenCalled()
  })

  it('asks for a query instead of sending an empty ranking request', async () => {
    const onPluginTool = vi.fn(async () => aiRanked)
    renderWithRuntimeTool(onPluginTool)
    await screen.findByTestId('scrapbook-ai-run')

    fireEvent.click(screen.getByTestId('scrapbook-ai-run'))

    expect(await screen.findByRole('alert')).toHaveTextContent('先在上方输入关键词')
    expect(onPluginTool).not.toHaveBeenCalled()
  })
})
