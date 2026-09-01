import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CodexMasterView } from './CodexMasterView'
import { db } from '../../../db/indexedDB'
import type { CodexEntity } from '../types'

describe('CodexMasterView Component', () => {
  const mockEntities: CodexEntity[] = [
    {
      id: 'ent-1',
      projectId: 'p1',
      name: '陈渊',
      aliases: ['渊哥'],
      category: 'character',
      attributes: { realm: '淬体九重' },
      relations: [],
      summary: '主角，废脉觉醒吞天神体',
      createdAt: 1000,
      updatedAt: 1000,
    },
    {
      id: 'ent-2',
      projectId: 'p1',
      name: '青岚宗',
      aliases: ['青岚剑派'],
      category: 'faction',
      attributes: {},
      relations: [],
      summary: '云州宗门',
      createdAt: 1000,
      updatedAt: 1000,
    },
  ]

  beforeEach(async () => {
    const all = await db.getAll<{ id: string }>('codexEntities')
    await Promise.all(all.map((r) => db.delete('codexEntities', r.id)))
    for (const ent of mockEntities) {
      await db.put('codexEntities', ent)
    }
  })

  it('renders entity list and stats accurately', async () => {
    render(<CodexMasterView projectId="p1" />)

    expect(await screen.findByText('主角，废脉觉醒吞天神体')).toBeInTheDocument()
    expect(await screen.findByText('云州宗门')).toBeInTheDocument()
    expect(screen.getByText(/已载入 2 个实体/)).toBeInTheDocument()
  })

  it('filters entities when category tab is clicked', async () => {
    render(<CodexMasterView projectId="p1" />)

    expect(await screen.findByText('主角，废脉觉醒吞天神体')).toBeInTheDocument()

    // 点击国家宗门标签
    const factionTab = screen.getByRole('button', { name: /国家宗门/ })
    fireEvent.click(factionTab)

    expect(await screen.findByText('云州宗门')).toBeInTheDocument()
    expect(screen.queryByText('主角，废脉觉醒吞天神体')).not.toBeInTheDocument()
  })

  it('filters entities via search input', async () => {
    render(<CodexMasterView projectId="p1" />)

    expect(await screen.findByText('主角，废脉觉醒吞天神体')).toBeInTheDocument()

    const searchInput = screen.getByPlaceholderText('搜名称/别名/摘要...')
    fireEvent.change(searchInput, { target: { value: '渊哥' } })

    expect(await screen.findByText('主角，废脉觉醒吞天神体')).toBeInTheDocument()
    expect(screen.queryByText('云州宗门')).not.toBeInTheDocument()
  })

  it('opens editor drawer when clicking on entity card', async () => {
    render(<CodexMasterView projectId="p1" />)

    const cardSummary = await screen.findByText('主角，废脉觉醒吞天神体')
    fireEvent.click(cardSummary)

    expect(await screen.findByText('编辑实体档案')).toBeInTheDocument()
    expect(screen.getByDisplayValue('陈渊')).toBeInTheDocument()
  })
})
