import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DiffReviewerMasterView } from './DiffReviewerMasterView'
import { DesktopPluginHostProvider } from '../../../core/pluginHostContext'

const chapter = {
  id: 'guarded-diff',
  projectId: 'p',
  volumeId: 'v',
  order: 0,
  title: '章',
  content: '全部删除',
  wordCount: 4,
  revision: 1,
  createdAt: 1,
  updatedAt: 1,
}
describe('reviewed diff source guards', () => {
  it('does not retain hunk decisions after the input changes', async () => {
    render(<DiffReviewerMasterView projectId="p" />)
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: '原稿' } })
    fireEvent.change(screen.getAllByRole('textbox')[1], { target: { value: '修订' } })
    fireEvent.click(screen.getByRole('button', { name: /计算差异分块/ }))
    await screen.findByText(/差异决策分块/)
    fireEvent.change(screen.getAllByRole('textbox')[1], { target: { value: '下一份修订' } })
    expect(screen.queryByText(/差异决策分块/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /全部纳入预览/ })).toBeDisabled()
  })
  it('ignores a late runtime result from an old source', async () => {
    let complete: ((data: unknown) => void) | undefined
    const tool = vi.fn(
      () =>
        new Promise((resolve) => {
          complete = resolve
        }),
    )
    render(
      <DesktopPluginHostProvider projectId="p" onPluginTool={tool} isAiConnected>
        <DiffReviewerMasterView projectId="p" />
      </DesktopPluginHostProvider>,
    )
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: '原稿' } })
    fireEvent.change(screen.getAllByRole('textbox')[1], { target: { value: '修订' } })
    fireEvent.click(screen.getByRole('button', { name: /计算差异分块/ }))
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: '后来的原稿' } })
    await act(async () => {
      complete?.({ hunks: [], stats: {} })
    })
    expect(screen.queryByText(/差异决策分块/)).not.toBeInTheDocument()
  })
  it('writes an accepted full deletion as empty content', async () => {
    await indexedDbProjectRepository.saveChapter(chapter)
    render(
      <DesktopPluginHostProvider projectId="p" activeChapter={chapter}>
        <DiffReviewerMasterView projectId="p" />
      </DesktopPluginHostProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: /计算差异分块/ }))
    await screen.findByText(/差异决策分块/)
    fireEvent.click(screen.getByRole('button', { name: /全部纳入预览/ }))
    fireEvent.click(screen.getByRole('button', { name: /写回正文章节/ }))
    await waitFor(async () =>
      expect(
        (await indexedDbProjectRepository.getChaptersByProject('p')).find(
          (c) => c.id === chapter.id,
        ),
      ).toMatchObject({ content: '', revision: 2 }),
    )
  })
})
