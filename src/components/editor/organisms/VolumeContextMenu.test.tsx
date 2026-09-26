import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { VolumeContextMenu } from './VolumeContextMenu'
import type { EditorModel } from '../hooks/useChapterEditorModel'
import type { VolumeRecord } from '../../../types'

afterEach(cleanup)

const volume: VolumeRecord = {
  id: 'v1',
  projectId: 'p1',
  title: '正文卷',
  order: 0,
  createdAt: 1,
  updatedAt: 1,
}

const makeModel = (actions: Partial<EditorModel['actions']> = {}) =>
  ({
    volumeContextMenu: { volume, x: 90, y: 160 },
    expanded: { v1: false },
    actions: {
      setVolumeContextMenu: vi.fn(),
      newChapter: vi.fn(),
      setRenamingVolume: vi.fn(),
      setRenamingVolumeTitle: vi.fn(),
      toggleVolume: vi.fn(),
      setDeletingVolume: vi.fn(),
      ...actions,
    },
  }) as unknown as EditorModel

describe('VolumeContextMenu — 复用通用菜单的键盘与 ARIA 语义（P4.3）', () => {
  it('渲染 role=menu、四个条目与光标坐标，展开项按真实状态取反', () => {
    render(<VolumeContextMenu model={makeModel()} />)
    const menu = screen.getByRole('menu')
    expect(menu).toHaveAttribute('aria-label', '分卷操作：正文卷')
    expect(menu).toHaveStyle({ left: '90px', top: '160px' })
    // expanded.v1 === false → 菜单应当提议「展开」而不是「收起」
    expect(screen.getByText('展开此分卷')).toBeInTheDocument()
    expect(screen.getAllByRole('menuitem')).toHaveLength(4)
  })

  it('点击新建章节先关闭菜单再派发命令', () => {
    const setVolumeContextMenu = vi.fn()
    const newChapter = vi.fn()
    render(<VolumeContextMenu model={makeModel({ setVolumeContextMenu, newChapter })} />)
    fireEvent.click(screen.getByText('新建章节 (插入本卷)'))
    expect(setVolumeContextMenu).toHaveBeenCalledWith(null)
    expect(newChapter).toHaveBeenCalledWith('v1')
  })

  it('删除分卷是危险项，且需要走确认弹窗而不是直接删', () => {
    const setDeletingVolume = vi.fn()
    render(<VolumeContextMenu model={makeModel({ setDeletingVolume })} />)
    const del = screen.getByText('删除分卷…')
    expect(del).toHaveClass('text-[var(--ink-danger)]')
    fireEvent.click(del)
    expect(setDeletingVolume).toHaveBeenCalledWith(volume)
  })

  it('Esc 关闭菜单', () => {
    const setVolumeContextMenu = vi.fn()
    render(<VolumeContextMenu model={makeModel({ setVolumeContextMenu })} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(setVolumeContextMenu).toHaveBeenCalledWith(null)
  })
})
