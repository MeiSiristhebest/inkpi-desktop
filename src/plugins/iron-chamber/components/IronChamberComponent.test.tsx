import { beforeEach, describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { db } from '../../../db/indexedDB'
import { indexedDbIronChamberRepository } from '../../../adapters/indexedDbIronChamberRepository'
import { DesktopPluginHostProvider } from '../../../core/pluginHostContext'
import type { ChapterRecord } from '../../../types'
import { IronChamberMasterView } from './IronChamberMasterView'
import { IronChamberDrawer } from './IronChamberDrawer'

describe('IronChamber UI Components', () => {
  const chapter: ChapterRecord = {
    id: 'focus-chapter',
    projectId: 'focus-project',
    volumeId: 'focus-volume',
    title: '作者章节',
    content: '<p>😀 A</p>',
    wordCount: 2,
    order: 0,
    revision: 1,
    createdAt: 1,
    updatedAt: 1,
  }
  beforeEach(async () => {
    for (const record of await indexedDbIronChamberRepository.getAll('focus-project'))
      await indexedDbIronChamberRepository.delete(record.id)
    await db.put('volumes', {
      id: 'focus-volume',
      projectId: 'focus-project',
      title: '作者卷',
      order: 0,
      createdAt: 1,
      updatedAt: 1,
    })
    await db.put('chapters', chapter)
  })
  it('IronChamberMasterView renders correctly', () => {
    render(<IronChamberMasterView projectId="p1" />)
    expect(screen.getByText(/黑曜石小黑屋/)).toBeDefined()
  })

  it('IronChamberDrawer renders correctly', () => {
    render(<IronChamberDrawer projectId="p1" currentText="林凡走在大街上。" />)
    expect(screen.getByText(/小黑屋心流守卫/)).toBeDefined()
  })

  it('counts the real chapter without creating an unsaved writing area, and retries a failed completion save', async () => {
    const onStats = vi.fn()
    const tree = (activeChapter: ChapterRecord) => (
      <DesktopPluginHostProvider projectId="focus-project" activeChapter={activeChapter}>
        <IronChamberMasterView projectId="focus-project" onStats={onStats} />
      </DesktopPluginHostProvider>
    )
    const view = render(tree(chapter))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '开始章节专注会话' })).toBeEnabled(),
    )
    fireEvent.change(screen.getByRole('spinbutton', { name: '目标新增字符' }), {
      target: { value: '2' },
    })
    fireEvent.click(screen.getByRole('button', { name: '开始章节专注会话' }))
    await screen.findByText('计数章节：作者章节')
    const record = (await indexedDbIronChamberRepository.getActive('focus-project'))!
    expect(record).toMatchObject({
      chapterId: chapter.id,
      startWords: 2,
      measurementUnit: 'unicode_non_whitespace',
    })
    expect(document.querySelector('textarea')).toBeNull()
    expect(onStats).toHaveBeenCalledWith(expect.objectContaining({ wordCount: 0 }))
    view.rerender(tree({ ...chapter, content: '<p>😀ABC</p>', revision: 2 }))
    const complete = screen.getByRole('button', { name: '保存目标完成' })
    expect(complete).toBeEnabled()
    const fault = vi
      .spyOn(indexedDbIronChamberRepository, 'finishSession')
      .mockRejectedValueOnce(new Error('disk busy'))
    try {
      fireEvent.click(complete)
      expect(await screen.findByRole('alert')).toHaveTextContent('disk busy')
      expect((await indexedDbIronChamberRepository.get(record.id))?.status).toBe('locked')
      fireEvent.click(complete)
      await waitFor(async () =>
        expect((await indexedDbIronChamberRepository.get(record.id))?.status).toBe('completed'),
      )
    } finally {
      fault.mockRestore()
    }
  })

  it('does not count another chapter and permits voluntary termination without an explanation', async () => {
    const record = {
      id: 'focus-record',
      projectId: 'focus-project',
      chapterId: chapter.id,
      measurementUnit: 'unicode_non_whitespace' as const,
      mode: 'words' as const,
      targetWords: 1000,
      targetMinutes: 0,
      startWords: 2,
      currentWords: 2,
      pledgedAt: Date.now(),
      status: 'locked' as const,
    }
    await indexedDbIronChamberRepository.startSession(record)
    render(
      <DesktopPluginHostProvider
        projectId="focus-project"
        activeChapter={{ ...chapter, id: 'other-chapter' }}
      >
        <IronChamberDrawer projectId="focus-project" currentText={'字'.repeat(2000)} />
      </DesktopPluginHostProvider>,
    )
    await screen.findByText(/当前章节不属于本会话/)
    expect(screen.getByRole('button', { name: '保存目标完成' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '自愿结束会话' }))
    await waitFor(async () =>
      expect((await indexedDbIronChamberRepository.get(record.id))?.status).toBe('emergency_abort'),
    )
    expect((await indexedDbIronChamberRepository.get(record.id))?.currentWords).toBe(2)
  })
})
