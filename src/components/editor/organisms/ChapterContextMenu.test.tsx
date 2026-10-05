import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ChapterContextMenu } from './ChapterContextMenu'
import type { EditorModel } from '../hooks/useChapterEditorModel'
import type { ChapterRecord, VolumeRecord } from '../../../types'

afterEach(cleanup)

const chapter: ChapterRecord = {
  id: 'ch-1',
  projectId: 'p1',
  volumeId: 'v1',
  title: '第一章 测灵大典',
  content: '<p>正文</p>',
  wordCount: 12,
  order: 0,
  status: 'review',
  createdAt: 1,
  updatedAt: 1,
}

const volumes: VolumeRecord[] = [
  { id: 'v1', projectId: 'p1', title: '正文卷', order: 0, createdAt: 1, updatedAt: 1 },
  { id: 'v2', projectId: 'p1', title: '外传', order: 1, createdAt: 1, updatedAt: 1 },
]

const makeModel = (actions: Partial<EditorModel['actions']> = {}) =>
  ({
    chapterContextMenu: { chapter, x: 140, y: 220 },
    copiedChapterId: null,
    excludedNumberingIds: new Set<string>(),
    volumes,
    actions: {
      setChapterContextMenu: vi.fn(),
      setRenamingChapter: vi.fn(),
      setRenamingTitle: vi.fn(),
      duplicateChapter: vi.fn(),
      copyChapterText: vi.fn(),
      toggleExcludeNumbering: vi.fn(),
      setStatus: vi.fn(),
      exportSingleChapter: vi.fn(),
      moveChapterToVolume: vi.fn(),
      setDeletingChapter: vi.fn(),
      ...actions,
    },
  }) as unknown as EditorModel

describe('ChapterContextMenu — 复用通用菜单的键盘与 ARIA 语义（P4.3）', () => {
  it('渲染 role=menu、章节标题与当前状态标记', () => {
    render(<ChapterContextMenu model={makeModel()} />)
    const menu = screen.getByRole('menu')
    expect(menu).toHaveAttribute('aria-label', '章节操作：第一章 测灵大典')
    expect(menu).toHaveStyle({ left: '140px', top: '220px' })
    expect(screen.getByText('第一章 测灵大典')).toBeInTheDocument()

    const radios = screen.getAllByRole('menuitemradio')
    expect(radios).toHaveLength(4)
    expect(radios.find((r) => r.getAttribute('aria-checked') === 'true')?.textContent).toContain(
      '审阅中',
    )
  })

  it('方向键在条目间移动焦点，Enter 直接派发命令', () => {
    const duplicateChapter = vi.fn()
    render(<ChapterContextMenu model={makeModel({ duplicateChapter })} />)
    const menu = screen.getByRole('menu')
    const items = screen.getAllByRole('menuitem')
    expect(document.activeElement).toBe(items[0])

    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[1])
    fireEvent.keyDown(menu, { key: 'Enter' })
    expect(duplicateChapter).toHaveBeenCalledWith(chapter)
  })

  it('Esc 只关闭菜单，不派发任何命令', () => {
    const setChapterContextMenu = vi.fn()
    const setDeletingChapter = vi.fn()
    render(<ChapterContextMenu model={makeModel({ setChapterContextMenu, setDeletingChapter })} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(setChapterContextMenu).toHaveBeenCalledWith(null)
    expect(setDeletingChapter).not.toHaveBeenCalled()
  })

  it('点击条目先关闭菜单再执行命令，删除走危险项', () => {
    const setChapterContextMenu = vi.fn()
    const setDeletingChapter = vi.fn()
    render(<ChapterContextMenu model={makeModel({ setChapterContextMenu, setDeletingChapter })} />)
    fireEvent.click(screen.getByText('删除本章节'))
    expect(setChapterContextMenu).toHaveBeenCalledWith(null)
    expect(setDeletingChapter).toHaveBeenCalledWith(chapter)
  })

  it('跨卷移动只列出其它分卷', () => {
    render(<ChapterContextMenu model={makeModel()} />)
    expect(screen.getByText('移入「外传」')).toBeInTheDocument()
    expect(screen.queryByText('移入「正文卷」')).not.toBeInTheDocument()
  })
})
