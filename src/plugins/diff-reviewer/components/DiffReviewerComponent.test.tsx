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

  it('DiffReviewerDrawer renders correctly with stats', () => {
    render(<DiffReviewerDrawer projectId="p1" currentText="林凡走在大街上。" />)
    expect(screen.getByText(/双栏审校随动/)).toBeDefined()
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

    fireEvent.click(screen.getByRole('button', { name: /计算差异分块/ }))
    await screen.findByText(/差异决策分块/)
    fireEvent.click(screen.getByRole('button', { name: /全部采纳/ }))
    fireEvent.click(screen.getByRole('button', { name: /写回正文章节/ }))

    await waitFor(() => expect(screen.getByRole('button', { name: '撤销写回' })).toBeInTheDocument())
    expect(saveChapter).toHaveBeenCalledTimes(1)
    expect(saveChapter.mock.calls[0][0]).toMatchObject({
      id: chapter.id,
      content: expect.not.stringMatching(/^原稿。$/),
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
    fireEvent.click(screen.getByRole('button', { name: /全部采纳/ }))
    fireEvent.click(screen.getByRole('button', { name: /写回正文章节/ }))

    await waitFor(() => expect(screen.getByRole('button', { name: '撤销写回' })).toBeInTheDocument())
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
