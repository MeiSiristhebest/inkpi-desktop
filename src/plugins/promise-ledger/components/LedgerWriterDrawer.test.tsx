import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LedgerWriterDrawer } from './LedgerWriterDrawer'
import { db } from '../../../db/indexedDB'
import type { PromiseLedgerEntry } from '../types'

describe('LedgerWriterDrawer — 写作台伏笔随动感知抽屉', () => {
  beforeEach(async () => {
    const all = await db.getAll<{ id: string }>('promiseLedger')
    await Promise.all(all.map((item) => db.delete('promiseLedger', item.id)))
  })

  it('detects and displays keyword matches from current text', async () => {
    const entry: PromiseLedgerEntry = {
      id: 'p1',
      projectId: 'p1',
      clueName: '太虚玄水印',
      tier: 'main_plot',
      plantChapter: 1,
      softDeadline: 10,
      dueChapterLimit: 20,
      plantNote: '主角偶得',
      status: 'planted',
      memoryDecayLambda: 0.05,
      progressHistory: [],
      relatedEntityIds: [],
      relatedChapterIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await db.put('promiseLedger', entry)

    render(
      <LedgerWriterDrawer
        projectId="p1"
        currentText="林枫手中暗扣着太虚玄水印，眼神冰冷地注视着来人。"
        currentChapterNumber={30}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('太虚玄水印')).toBeInTheDocument()
      expect(screen.getByText('匹配「太虚玄水印」')).toBeInTheDocument()
    })

    // 点击确认兑现
    expect(screen.getByText('确认兑现')).toBeDisabled()
    fireEvent.change(screen.getByLabelText('伏笔推进或兑现说明'), {
      target: { value: '此处完成了作者规划的回收。' },
    })
    fireEvent.click(screen.getByText('确认兑现'))
    await waitFor(async () => {
      const saved = await db.get<PromiseLedgerEntry>('promiseLedger', 'p1')
      expect(saved?.status).toBe('paid_off')
      expect(saved?.payoffChapter).toBe(30)
    })
  })

  it('switches to debt warnings tab and renders overdue warnings', async () => {
    const entry: PromiseLedgerEntry = {
      id: 'p2',
      projectId: 'p1',
      clueName: '九渊魔鼎',
      tier: 'main_plot',
      plantChapter: 1,
      softDeadline: 0,
      dueChapterLimit: 1, // 第 2 章相对第 1 章已过去 1 章，达到登记的期限
      plantNote: '主角偶得',
      status: 'planted',
      memoryDecayLambda: 0.05,
      progressHistory: [],
      relatedEntityIds: [],
      relatedChapterIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await db.put('promiseLedger', entry)

    render(<LedgerWriterDrawer projectId="p1" currentText="无匹配文本" currentChapterNumber={3} />)
    await waitFor(() => expect(screen.getByText(/债务告警/)).toBeInTheDocument())

    fireEvent.click(screen.getByText(/债务告警/))
    await waitFor(() => {
      expect(screen.getByText('九渊魔鼎')).toBeInTheDocument()
      expect(screen.getByText('已超期')).toBeInTheDocument()
    })
  })

  it('records a progress event at the active chapter number', async () => {
    const entry: PromiseLedgerEntry = {
      id: 'p3',
      projectId: 'p1',
      clueName: '照月刀',
      tier: 'main_plot',
      plantChapter: 2,
      softDeadline: 10,
      dueChapterLimit: 20,
      plantNote: '主角偶得',
      status: 'planted',
      memoryDecayLambda: 0.05,
      progressHistory: [],
      relatedEntityIds: [],
      relatedChapterIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await db.put('promiseLedger', entry)

    render(
      <LedgerWriterDrawer
        projectId="p1"
        currentText="照月刀出鞘，刀锋映出月光。"
        currentChapterNumber={30}
      />,
    )

    await waitFor(() => expect(screen.getByText('照月刀')).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('伏笔推进或兑现说明'), {
      target: { value: '刀再次出现，作者登记推进。' },
    })
    fireEvent.click(screen.getByRole('button', { name: '推进' }))

    await waitFor(async () => {
      const saved = await db.get<PromiseLedgerEntry>('promiseLedger', 'p3')
      expect(saved?.progressHistory.at(-1)?.chapter).toBe(30)
    })
  })

  it('does not invent chapter one when no chapter is active', async () => {
    const entry: PromiseLedgerEntry = {
      id: 'p4',
      projectId: 'p1',
      clueName: '玄霜玉佩',
      tier: 'main_plot',
      plantChapter: 1,
      softDeadline: 10,
      dueChapterLimit: 20,
      plantNote: '主角偶得',
      status: 'planted',
      memoryDecayLambda: 0.05,
      progressHistory: [],
      relatedEntityIds: [],
      relatedChapterIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await db.put('promiseLedger', entry)

    render(<LedgerWriterDrawer projectId="p1" currentText="玄霜玉佩在月下发光。" />)

    expect(await screen.findByRole('status')).toHaveTextContent('选择章节后才能记录伏笔位置')
    expect(screen.getByText('未选择章节')).toBeInTheDocument()
    const saved = await db.get<PromiseLedgerEntry>('promiseLedger', 'p4')
    expect(saved?.status).toBe('planted')
    expect(saved?.payoffChapter).toBeUndefined()
  })

  it('discloses that unplaced promises cannot be checked for expiry', async () => {
    await db.put('promiseLedger', {
      id: 'p-unknown',
      projectId: 'p1',
      clueName: '待定位玉佩',
      tier: 'side_arc',
      plantChapter: 0,
      softDeadline: 0,
      dueChapterLimit: 0,
      plantNote: '',
      status: 'planted',
      memoryDecayLambda: 0.05,
      progressHistory: [],
      relatedEntityIds: [],
      relatedChapterIds: [],
      createdAt: 1,
      updatedAt: 1,
    })
    render(<LedgerWriterDrawer projectId="p1" currentText="无匹配" currentChapterNumber={50} />)
    fireEvent.click(await screen.findByText(/债务告警/))
    expect(
      await screen.findByText('1 条伏笔未指定章节或期限，暂不能评估到期情况。'),
    ).toBeInTheDocument()
    expect(screen.queryByText('叙事债务处于健康状态')).not.toBeInTheDocument()
  })
})
