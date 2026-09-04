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
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('太虚玄水印')).toBeInTheDocument()
      expect(screen.getByText('匹配「太虚玄水印」')).toBeInTheDocument()
    })

    // 点击确认兑现
    fireEvent.click(screen.getByText('确认兑现'))
    await waitFor(async () => {
      const saved = await db.get<PromiseLedgerEntry>('promiseLedger', 'p1')
      expect(saved?.status).toBe('paid_off')
    })
  })

  it('switches to debt warnings tab and renders overdue warnings', async () => {
    const entry: PromiseLedgerEntry = {
      id: 'p2',
      projectId: 'p1',
      clueName: '九渊魔鼎',
      tier: 'main_plot',
      plantChapter: 0,
      softDeadline: 0,
      dueChapterLimit: 1, // at chapter 1, 1-0 = 1 >= 1 => overdue
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

    render(<LedgerWriterDrawer projectId="p1" currentText="无匹配文本" />)
    await waitFor(() => expect(screen.getByText(/债务告警/)).toBeInTheDocument())

    fireEvent.click(screen.getByText(/债务告警/))
    expect(screen.getByText('九渊魔鼎')).toBeInTheDocument()
    expect(screen.getByText('已超期')).toBeInTheDocument()
  })
})
