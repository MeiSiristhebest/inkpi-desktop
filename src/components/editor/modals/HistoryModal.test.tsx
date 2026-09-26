import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { HistoryModal, type VersionSnapshot } from './HistoryModal'
import type { ChapterRecord } from '../../../types'
import type { KeyValueStore } from '../../../ports/keyValueStore'

const chapter: ChapterRecord = {
  id: 'ch-1',
  projectId: 'p-1',
  volumeId: 'v-1',
  title: '第一章',
  content: '<p>当前正文</p>',
  wordCount: 100,
  order: 1,
  createdAt: 1000,
  updatedAt: 2000,
}

const milestone: VersionSnapshot = {
  id: 'm-1',
  name: '第一卷定稿',
  timestamp: 1_700_000_000_000,
  wordCount: 80,
  content: '<p>旧稿</p>',
  kind: 'milestone',
}
const newerAuto: VersionSnapshot = {
  id: 'a-1',
  timestamp: 1_700_000_100_000,
  wordCount: 90,
  content: '<p>上一版</p>',
  kind: 'auto',
}
const olderAuto: VersionSnapshot = {
  id: 'a-0',
  timestamp: 1_700_000_050_000,
  wordCount: 70,
  content: '<p>更早</p>',
  kind: 'auto',
}

function memoryStore(
  entries: Record<string, string> = {},
): KeyValueStore & { data: Map<string, string> } {
  const data = new Map(Object.entries(entries))
  return {
    data,
    get: async (key) => data.get(key) ?? null,
    set: async (key, value) => {
      data.set(key, value)
    },
  }
}

/** saveSnapshot 的落盘顺序：[最新自动, ...其余自动, ...里程碑] */
function historyKv(snapshots: VersionSnapshot[]) {
  return memoryStore({ 'chapter-history-ch-1': JSON.stringify(snapshots) })
}

describe('HistoryModal 里程碑与自动检查点分区', () => {
  it('把两类快照分到各自带条数的分组里', async () => {
    const kvStore = historyKv([newerAuto, olderAuto, milestone])
    render(
      <HistoryModal chapter={chapter} onRestore={vi.fn()} onClose={vi.fn()} kvStore={kvStore} />,
    )

    await waitFor(() => expect(screen.getByText('第一卷定稿')).toBeInTheDocument())

    const milestoneGroup = screen.getByRole('region', { name: '里程碑' })
    const autoGroup = screen.getByRole('region', { name: '自动检查点' })

    expect(within(milestoneGroup).getByText('1 条 · 不会自动丢弃')).toBeInTheDocument()
    expect(within(autoGroup).getByText('2 条 · 最多保留 20 条')).toBeInTheDocument()
    expect(within(milestoneGroup).getByText('第一卷定稿')).toBeInTheDocument()
    expect(within(autoGroup).getAllByText(/检查点 #/)).toHaveLength(2)
    expect(within(milestoneGroup).queryByText(/检查点 #/)).toBeNull()
    expect(within(autoGroup).queryByText('第一卷定稿')).toBeNull()
    // 分区只是视图分组：同一条快照不会被复制成两行
    expect(screen.getAllByText('第一卷定稿')).toHaveLength(1)
    expect(screen.getByText(/里程碑定稿永久保留/)).toBeInTheDocument()
  })

  it('只给里程碑删除入口，并且删除后自动检查点原样保留', async () => {
    const kvStore = historyKv([newerAuto, olderAuto, milestone])
    render(
      <HistoryModal chapter={chapter} onRestore={vi.fn()} onClose={vi.fn()} kvStore={kvStore} />,
    )
    await waitFor(() => expect(screen.getByText('第一卷定稿')).toBeInTheDocument())

    expect(screen.queryAllByTitle('删除此里程碑')).toHaveLength(1)
    fireEvent.click(
      within(screen.getByRole('region', { name: '里程碑' })).getByTitle('删除此里程碑'),
    )
    fireEvent.click(screen.getByText('确认删除'))

    await waitFor(() => expect(screen.queryByText('第一卷定稿')).toBeNull())
    expect(
      within(screen.getByRole('region', { name: '里程碑' })).getByText(/还没有里程碑/),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('region', { name: '自动检查点' })).getAllByText(/检查点 #/),
    ).toHaveLength(2)

    const persisted: Array<{ id?: string }> = JSON.parse(
      kvStore.data.get('chapter-history-ch-1') || '[]',
    )
    expect(persisted.map((item) => item.id)).toEqual(['a-1', 'a-0'])
  })

  it('没有历史时先给出可用的里程碑说明，而不是空白列表', async () => {
    const kvStore = memoryStore()
    render(
      <HistoryModal chapter={chapter} onRestore={vi.fn()} onClose={vi.fn()} kvStore={kvStore} />,
    )

    await waitFor(() => expect(screen.getByText('初始版本')).toBeInTheDocument())
    expect(
      within(screen.getByRole('region', { name: '自动检查点' })).getByText(/还没有自动检查点/),
    ).toBeInTheDocument()
    expect(screen.getByText(/最多保留 20 条；里程碑定稿永久保留/)).toBeInTheDocument()
  })
})
