import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { LedgerMasterView } from './LedgerMasterView'
import { db } from '../../../db/indexedDB'

describe('LedgerMasterView — 伏笔账本主视口', () => {
  beforeEach(async () => {
    const all = await db.getAll<{ id: string }>('promiseLedger')
    await Promise.all(all.map((item) => db.delete('promiseLedger', item.id)))
  })

  it('renders empty state when no entries exist and allows seeding demo data', async () => {
    render(<LedgerMasterView projectId="p1" />)
    expect(await screen.findByText(/尚无伏笔记录/)).toBeInTheDocument()
    expect(screen.getByText('预载修仙伏笔演示包')).toBeInTheDocument()

    // 点击预载演示包
    fireEvent.click(screen.getByText('预载修仙伏笔演示包'))
    await waitFor(() => {
      expect(screen.getAllByText('断界残鼎的第三重封印').length).toBeGreaterThan(0)
    })
  })

  it('allows opening the modal and creating a new promise entry', async () => {
    render(<LedgerMasterView projectId="p1" />)
    await screen.findByText(/尚无伏笔记录/)

    fireEvent.click(screen.getByText('埋下伏笔'))
    expect(await screen.findByText('新建 3P 伏笔（契诃夫之枪）')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText(/例如：残破青铜鼎/), {
      target: { value: '天命血符' },
    })
    fireEvent.click(screen.getByText('保存伏笔'))

    await waitFor(() => {
      expect(screen.getAllByText('天命血符').length).toBeGreaterThan(0)
    })
  })

  it('defaults new promises to the one-based number after the project chapters', async () => {
    const projectId = 'p-ledger-chapter-number'
    await db.put('volumes', {
      id: 'volume-ledger',
      projectId,
      order: 0,
      title: '卷一',
      createdAt: 1,
      updatedAt: 1,
    })
    await db.put('chapters', {
      id: 'chapter-ledger-1',
      projectId,
      volumeId: 'volume-ledger',
      title: '第一章',
      content: '第一章正文',
      wordCount: 5,
      order: 0,
      createdAt: 1,
      updatedAt: 1,
    })
    await db.put('chapters', {
      id: 'chapter-ledger-2',
      projectId,
      volumeId: 'volume-ledger',
      title: '第二章',
      content: '第二章正文',
      wordCount: 5,
      order: 1,
      createdAt: 1,
      updatedAt: 1,
    })

    render(<LedgerMasterView projectId={projectId} />)
    await screen.findByText(/尚无伏笔记录/)
    fireEvent.click(screen.getByText('埋下伏笔'))

    const numberInputs = await screen.findAllByRole('spinbutton')
    expect(numberInputs[0]).toHaveValue(2)
  })

  it('switches between gantt and list view modes', async () => {
    render(<LedgerMasterView projectId="p1" />)
    await screen.findByText(/尚无伏笔记录/)
    fireEvent.click(screen.getByText('预载修仙伏笔演示包'))
    await waitFor(() => {
      expect(screen.getAllByText('断界残鼎的第三重封印').length).toBeGreaterThan(0)
    })

    // 切换到列表模式
    fireEvent.click(screen.getByText('列表'))
    expect(screen.getByText('线索名称')).toBeInTheDocument()
    expect(screen.getByText('最近推进章节')).toBeInTheDocument()

    // 切换回甘特图模式
    fireEvent.click(screen.getByText('甘特图'))
    expect(screen.getByText('伏笔时空甘特轴')).toBeInTheDocument()
  })

  it('shows unplaced promises without invented deadlines or memory heat and keeps them editable', async () => {
    await db.put('promiseLedger', {
      id: 'unplaced-promise',
      projectId: 'p1',
      clueName: '待定位玉佩',
      tier: 'side_arc',
      plantChapter: 0,
      softDeadline: 0,
      dueChapterLimit: 0,
      plantNote: '尚待作者确认',
      status: 'planted',
      memoryDecayLambda: 0.05,
      progressHistory: [],
      relatedEntityIds: [],
      relatedChapterIds: [],
      createdAt: 1,
      updatedAt: 1,
    })
    render(<LedgerMasterView projectId="p1" />)
    await screen.findByText('伏笔时空甘特轴')
    expect(screen.getByText('1 条伏笔未指定章节或期限，暂不能评估到期情况。')).toBeInTheDocument()
    expect(screen.getAllByText(/未指定章节/).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByText('列表'))
    const row = within(screen.getByRole('row', { name: /待定位玉佩/ }))
    expect(row.getByText('未指定章节')).toBeInTheDocument()
    expect(row.getByText('未设置期限')).toBeInTheDocument()
    expect(row.getByText('未登记')).toBeInTheDocument()
    expect(row.queryByText(/第\s*0\s*章|100%|已超期/)).not.toBeInTheDocument()
    fireEvent.click(row.getByRole('button', { name: '编辑' }))
    expect(await screen.findByText('编辑伏笔账本条目')).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText(/例如：残破青铜鼎/), {
      target: { value: '作者修改的玉佩' },
    })
    fireEvent.click(screen.getByText('保存伏笔'))
    await waitFor(() => expect(screen.queryByText('编辑伏笔账本条目')).not.toBeInTheDocument())
    expect(await db.get<any>('promiseLedger', 'unplaced-promise')).toMatchObject({
      clueName: '作者修改的玉佩',
      plantChapter: 0,
      softDeadline: 0,
      dueChapterLimit: 0,
    })
  })
})
