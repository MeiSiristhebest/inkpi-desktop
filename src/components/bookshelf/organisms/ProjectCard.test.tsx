import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProjectCard } from './ProjectCard'
import type { ProjectRecord } from '../../../types'
import type { ProjectStats } from '../../../core/projectService'

const project: ProjectRecord = {
  id: 'p1',
  name: '时雨集',
  genre: '都市',
  intro: '',
  createdAt: 1,
  updatedAt: 1,
}

const renderCard = (stats?: ProjectStats) =>
  render(
    <ProjectCard
      project={project}
      stats={stats}
      isEditing={false}
      isMenuOpen={false}
      isCustom={false}
      onOpen={vi.fn()}
      onToggleMenu={vi.fn()}
      onCloseMenu={vi.fn()}
      onStartEdit={vi.fn()}
      onExport={vi.fn()}
      onExportManuscript={vi.fn()}
      onRemoveFromLibrary={vi.fn()}
      onDelete={vi.fn()}
      onSaveEdit={vi.fn()}
      onCancelEdit={vi.fn()}
    />,
  )

describe('ProjectCard 续写入口（P1.3 / P3.7）', () => {
  it('拿到续写指针时直接说出继续哪一章', () => {
    renderCard({
      words: 60,
      chapters: 3,
      volumes: 1,
      lastUpdated: 1,
      resumeChapterTitle: '第002章',
    })
    const cta = screen.getByRole('button', { name: /继续《第002章》/ })
    expect(cta).toBeInTheDocument()
    // max-w + truncate 只是视觉裁切，DOM 里的章节名必须完整（可访问名取的就是这段文字）
    expect(cta).toHaveTextContent('继续《第002章》')
    expect(screen.queryByRole('button', { name: '继续写作' })).toBeNull()
  })

  it('没有指针但有章节时只承诺「继续写作」', () => {
    renderCard({ words: 10, chapters: 1, volumes: 1, lastUpdated: 1 })
    expect(screen.getByRole('button', { name: '继续写作' })).toBeInTheDocument()
  })

  it('空项目不假装可继续', () => {
    renderCard({ words: 0, chapters: 0, volumes: 0, lastUpdated: 0 })
    expect(screen.getByRole('button', { name: '打开项目' })).toBeInTheDocument()
  })
})
