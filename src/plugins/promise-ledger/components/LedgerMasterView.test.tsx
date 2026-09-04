import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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
    expect(screen.getByText('读者记忆热度')).toBeInTheDocument()

    // 切换回甘特图模式
    fireEvent.click(screen.getByText('甘特图'))
    expect(screen.getByText('伏笔时空甘特轴')).toBeInTheDocument()
  })
})
