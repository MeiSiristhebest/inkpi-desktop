import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { FolderOpen } from 'lucide-react'
import { Placeholder } from './Placeholder'

describe('Placeholder atom', () => {
  afterEach(() => cleanup())

  it('renders title, description and role="status"', () => {
    render(
      <Placeholder
        icon={FolderOpen}
        title="暂无章节草稿"
        desc="从左侧目录树添加第一卷和第一章以开启创作"
      />,
    )
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('暂无章节草稿')).toBeInTheDocument()
    expect(screen.getByText('从左侧目录树添加第一卷和第一章以开启创作')).toBeInTheDocument()
  })

  it('renders optional action CTA button and triggers callback on click', () => {
    const handleAction = vi.fn()
    render(
      <Placeholder
        icon={FolderOpen}
        title="暂无数据"
        desc="请点击下方按钮新建"
        action={{ label: '新建章节', onClick: handleAction }}
      />,
    )
    const btn = screen.getByRole('button', { name: '新建章节' })
    expect(btn).toBeInTheDocument()
    fireEvent.click(btn)
    expect(handleAction).toHaveBeenCalledTimes(1)
  })
})
