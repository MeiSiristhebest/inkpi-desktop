import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DiffReviewerMasterView } from './DiffReviewerMasterView'
import { DiffReviewerDrawer } from './DiffReviewerDrawer'
import { DesktopPluginHostProvider } from '../../../core/pluginHostContext'

const { saveChapter } = vi.hoisted(() => ({
  saveChapter: vi.fn(),
}))

vi.mock('../../../adapters/indexedDbProjectRepository', () => ({
  indexedDbProjectRepository: { saveChapter },
}))

describe('DiffReviewer UI Components', () => {
  beforeEach(() => {
    saveChapter.mockClear()
    saveChapter.mockResolvedValue(undefined)
  })

  it('DiffReviewerMasterView renders correctly', () => {
    render(<DiffReviewerMasterView projectId="p1" />)
    expect(screen.getByText(/双栏 Plan\/Apply 审校与合并器/)).toBeDefined()
  })

  it('DiffReviewerDrawer reports real facts and never invents revision hunks', async () => {
    render(<DiffReviewerDrawer projectId="p1" currentText="林凡走在大街上。" />)
    expect(screen.getByText(/双栏审校随动/)).toBeDefined()
    expect(screen.getByText(/已保存稿 8 字/)).toBeDefined()
    // §P2.3/INV-05：随动面板以前用正则改写正文造出一份假 diff，再报「N 处修订分块」。
    expect(screen.queryByText(/处修订分块/)).not.toBeInTheDocument()
    expect(screen.queryByText(/新增字行/)).not.toBeInTheDocument()
    expect(screen.getByText(/还没有打开章节/)).toBeInTheDocument()
  })

  it('DiffReviewerDrawer lists only real proposal-ledger records for the chapter', async () => {
    const chapter = {
      id: 'diff-reviewer-drawer-chapter',
      projectId: 'p1',
      volumeId: 'v1',
      title: '第一章',
      content: '林凡走在大街上。',
      wordCount: 8,
      order: 1,
      revision: 1,
      createdAt: 1,
      updatedAt: 1,
    }

    render(
      <DesktopPluginHostProvider projectId="p1" activeChapter={chapter}>
        <DiffReviewerDrawer projectId="p1" currentText="林凡走在大街上。" />
      </DesktopPluginHostProvider>,
    )

    // 账本里确实没有这一章的写回记录，那就直说，而不是造出差异来填。
    expect(await screen.findByText(/本章还没有审校写回记录/)).toBeInTheDocument()
    expect(screen.queryByText(/处修订分块/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Hunk #1/)).not.toBeInTheDocument()
  })

  it('starts blank and refuses to compute from two empty panels', async () => {
    const onPluginTool = vi.fn(async () => null)
    const onStats = vi.fn()
    render(
      <DesktopPluginHostProvider projectId="p1" onPluginTool={onPluginTool} isAiConnected>
        <DiffReviewerMasterView projectId="p1" onStats={onStats} />
      </DesktopPluginHostProvider>,
    )

    // §P2.4：没有正文可带的时候必须是空白，不能塞一段仙侠示例稿冒充本书原稿。
    const [original, proposed] = screen.getAllByRole('textbox')
    expect(original.value).toBe('')
    expect(proposed.value).toBe('')
    // 统计口径也不能替作者把示例稿的字数报上去。
    expect(onStats).toHaveBeenCalledWith(expect.objectContaining({ wordCount: 0 }))

    fireEvent.click(screen.getByRole('button', { name: /计算差异分块/ }))
    expect(screen.getByText(/两栏都还是空的/)).toBeInTheDocument()
    expect(screen.queryByText(/差异决策分块/)).not.toBeInTheDocument()
    // §P2.7：空白输入不该惊动运行时 AI。
    expect(onPluginTool).not.toHaveBeenCalled()
    expect(saveChapter).not.toHaveBeenCalled()
  })

  it('records reviewed writeback as a durable proposal and supports undo', async () => {
    const chapter = {
      id: 'diff-reviewer-chapter',
      projectId: 'p1',
      volumeId: 'v1',
      title: '第一章',
      content: '原稿。',
      wordCount: 3,
      order: 1,
      revision: 1,
      createdAt: 1,
      updatedAt: 1,
    }

    render(
      <DesktopPluginHostProvider projectId="p1" activeChapter={chapter}>
        <DiffReviewerMasterView projectId="p1" />
      </DesktopPluginHostProvider>,
    )

    // §P2.4：修订稿不再预置示例文本，作者给什么才算什么。
    fireEvent.change(screen.getAllByRole('textbox')[1], { target: { value: '原稿修订。' } })
    fireEvent.click(screen.getByRole('button', { name: /计算差异分块/ }))
    await screen.findByText(/差异决策分块/)
    fireEvent.click(screen.getByRole('button', { name: /全部纳入预览/ }))
    expect(screen.queryByText(/写回状态/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /写回正文章节/ }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: '撤销写回' })).toBeInTheDocument(),
    )
    // §P2.15：「已落盘」只能由权威写入出现，逐块取舍那一层不许用这个词。
    expect(screen.getByText('写回状态：已落盘')).toBeInTheDocument()
    expect(saveChapter).toHaveBeenCalledTimes(1)
    expect(saveChapter.mock.calls[0][0]).toMatchObject({
      id: chapter.id,
      content: '原稿修订。',
      revision: 2,
    })

    fireEvent.click(screen.getByRole('button', { name: '撤销写回' }))
    await waitFor(() => expect(screen.getByRole('button', { name: /写回正文章节/ })).toBeEnabled())
    expect(saveChapter).toHaveBeenCalledTimes(2)
    expect(saveChapter.mock.calls[1][0]).toMatchObject({
      id: chapter.id,
      content: '原稿。',
      revision: 3,
    })
  })

  it('uses semantic text for AI input while keeping HTML through writeback and undo', async () => {
    const originalHtml = '<p>原稿第一段。</p><p>原稿第二段。</p>'
    const proposedHtml = '<p>改写第一段。</p><p>改写第二段。</p>'
    const originalSemanticText = '原稿第一段。\n原稿第二段。'
    const proposedSemanticText = '改写第一段。\n改写第二段。'
    const onPluginTool = vi.fn(async () => null)
    const chapter = {
      id: 'diff-reviewer-html-chapter',
      projectId: 'p1',
      volumeId: 'v1',
      title: '第一章',
      content: originalHtml,
      wordCount: originalSemanticText.length,
      order: 1,
      revision: 1,
      createdAt: 1,
      updatedAt: 1,
    }

    render(
      <DesktopPluginHostProvider
        projectId="p1"
        activeChapter={chapter}
        onPluginTool={onPluginTool}
        isAiConnected
      >
        <DiffReviewerMasterView projectId="p1" />
      </DesktopPluginHostProvider>,
    )

    fireEvent.change(screen.getAllByRole('textbox')[1], {
      target: { value: proposedHtml },
    })
    fireEvent.click(screen.getByRole('button', { name: /计算差异分块/ }))

    await waitFor(() => {
      expect(onPluginTool).toHaveBeenCalledWith('diff-reviewer', {
        oldText: originalSemanticText,
        newText: proposedSemanticText,
      })
    })
    await screen.findByText(/差异决策分块/)
    fireEvent.click(screen.getByRole('button', { name: /全部纳入预览/ }))
    fireEvent.click(screen.getByRole('button', { name: /写回正文章节/ }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: '撤销写回' })).toBeInTheDocument(),
    )
    expect(saveChapter).toHaveBeenCalledTimes(1)
    expect(saveChapter.mock.calls[0][0]).toMatchObject({
      id: chapter.id,
      content: '<p>改写第一段。</p><p>改写第二段。</p>',
      revision: 2,
    })

    fireEvent.click(screen.getByRole('button', { name: '撤销写回' }))
    await waitFor(() => expect(screen.getByRole('button', { name: /写回正文章节/ })).toBeEnabled())
    expect(saveChapter).toHaveBeenCalledTimes(2)
    expect(saveChapter.mock.calls[1][0]).toMatchObject({
      id: chapter.id,
      content: originalHtml,
      revision: 3,
    })
  })
})
