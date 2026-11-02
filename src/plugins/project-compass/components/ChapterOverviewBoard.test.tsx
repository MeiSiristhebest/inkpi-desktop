import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ChapterRecord, VolumeRecord } from '../../../types'
import { ChapterOverviewBoard } from './ChapterOverviewBoard'

function makeVolume(id: string, title: string, order: number): VolumeRecord {
  return { id, projectId: 'project-1', title, order, createdAt: 1, updatedAt: 1 }
}

function makeChapter(
  id: string,
  volumeId: string,
  title: string,
  order: number,
  status: ChapterRecord['status'] = 'draft',
): ChapterRecord {
  return {
    id,
    projectId: 'project-1',
    volumeId,
    title,
    content: '<p>正文</p>',
    wordCount: 2,
    order,
    status,
    createdAt: 1,
    updatedAt: 1,
  }
}

const volumes = [makeVolume('volume-1', '第一卷', 1), makeVolume('volume-2', '第二卷', 2)]

function renderBoard(chapters: ChapterRecord[], onOpenChapter = vi.fn()) {
  render(
    <ChapterOverviewBoard
      projectId="project-1"
      volumes={volumes}
      chapters={chapters}
      loading={false}
      onOpenChapter={onOpenChapter}
    />,
  )
  return onOpenChapter
}

describe('ChapterOverviewBoard', () => {
  it('searches real chapter records and opens the exact selected chapter', () => {
    const onOpenChapter = renderBoard([
      makeChapter('chapter-1', 'volume-1', '雪夜来客', 1, 'published'),
      makeChapter('chapter-2', 'volume-2', '旧城归途', 1),
    ])

    fireEvent.change(screen.getByRole('searchbox', { name: '搜索章节' }), {
      target: { value: '第二卷' },
    })
    expect(
      screen.getByRole('button', { name: '在章节总览中打开《旧城归途》正文' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: '在章节总览中打开《雪夜来客》正文' }),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '在章节总览中打开《旧城归途》正文' }))
    expect(onOpenChapter).toHaveBeenCalledExactlyOnceWith('chapter-2')
  })

  it('searches chapter summaries and shows the matching synopsis', () => {
    const chapter = makeChapter('chapter-summary', 'volume-2', '夜行', 1)
    chapter.synopsis = '主角穿过灰烬寻找失散的妹妹。'
    renderBoard([chapter])

    fireEvent.change(screen.getByRole('searchbox', { name: '搜索章节' }), {
      target: { value: '失散的妹妹' },
    })

    expect(screen.getByRole('button', { name: '在章节总览中打开《夜行》正文' })).toHaveTextContent(
      '主角穿过灰烬寻找失散的妹妹',
    )
  })

  it('filters by volume and chapter status', () => {
    renderBoard([
      makeChapter('chapter-1', 'volume-1', '已完稿', 1, 'published'),
      makeChapter('chapter-2', 'volume-1', '正在审阅', 2, 'review'),
      makeChapter('chapter-3', 'volume-2', '第二卷草稿', 1),
    ])

    fireEvent.change(screen.getByRole('combobox', { name: '按分卷筛选' }), {
      target: { value: 'volume-1' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: '按状态筛选' }), {
      target: { value: 'review' },
    })

    expect(
      screen.getByRole('button', { name: '在章节总览中打开《正在审阅》正文' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: '在章节总览中打开《已完稿》正文' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: '在章节总览中打开《第二卷草稿》正文' }),
    ).not.toBeInTheDocument()
  })

  it('bounds the initial list and reveals more actual chapters on request', () => {
    const chapters = Array.from({ length: 45 }, (_, index) =>
      makeChapter(`chapter-${index + 1}`, 'volume-1', `章节 ${index + 1}`, index + 1),
    )
    renderBoard(chapters)

    expect(screen.getAllByRole('button', { name: /在章节总览中打开/ })).toHaveLength(40)
    fireEvent.click(screen.getByRole('button', { name: '显示更多章节（40 / 45）' }))
    expect(screen.getAllByRole('button', { name: /在章节总览中打开/ })).toHaveLength(45)
  })

  it('shows distinct loading and empty states', () => {
    const onOpenChapter = vi.fn()
    const { rerender } = render(
      <ChapterOverviewBoard
        projectId="project-1"
        volumes={volumes}
        chapters={[]}
        loading
        onOpenChapter={onOpenChapter}
      />,
    )
    expect(screen.getByText('正在读取本作品章节…')).toBeInTheDocument()

    rerender(
      <ChapterOverviewBoard
        projectId="project-1"
        volumes={volumes}
        chapters={[]}
        loading={false}
        onOpenChapter={onOpenChapter}
      />,
    )
    expect(screen.getByText('本作品还没有章节记录。')).toBeInTheDocument()
  })
})
