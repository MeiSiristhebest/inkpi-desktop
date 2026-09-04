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
  })

  it('renders rich empty state with 3 worldview demo packs when no entities exist', async () => {
    render(<CodexMasterView projectId="p1" />)

    expect(await screen.findByText('开启你的活体世界观图谱')).toBeInTheDocument()
    expect(screen.getByText('九霄问仙录 (东方修仙)')).toBeInTheDocument()
    expect(screen.getByText('夜幕霓虹 (赛博朋克)')).toBeInTheDocument()
    expect(screen.getByText('圣剑与龙王座 (西方奇幻)')).toBeInTheDocument()
  })

  it('allows loading a worldview demo pack in one click from empty state', async () => {
    render(<CodexMasterView projectId="p1" />)

    const loadXianxiaBtn = (await screen.findAllByText('一键预载此世界观'))[0]
    fireEvent.click(loadXianxiaBtn)

    // 应该灌入陈渊、青岚宗、青铜小塔等
    expect(await screen.findByText('废脉觉醒吞天神体的男主，行事果决沉稳，不信天命，深藏不露。')).toBeInTheDocument()
    expect(screen.getByText(/已载入 8 个实体/)).toBeInTheDocument()
  })

  it('filters loaded entities when category tab is clicked', async () => {
    for (const ent of mockEntities) {
      await db.put('codexEntities', ent)
    }

    render(<CodexMasterView projectId="p1" />)

    expect(await screen.findByText('主角，废脉觉醒吞天神体')).toBeInTheDocument()

    // 点击国家宗门标签
    const factionTab = screen.getByRole('button', { name: /国家宗门/ })
    fireEvent.click(factionTab)

    expect(await screen.findByText('云州宗门')).toBeInTheDocument()
    expect(screen.queryByText('主角，废脉觉醒吞天神体')).not.toBeInTheDocument()
  })

  it('opens template picker modal when clicking template library button', async () => {
    for (const ent of mockEntities) {
      await db.put('codexEntities', ent)
    }

    render(<CodexMasterView projectId="p1" />)

    const templateBtn = await screen.findByTitle('浏览 36+ 种男女核心人设与世界观模版')
    fireEvent.click(templateBtn)

    expect(await screen.findByText(/36\+ 款预置模板/)).toBeInTheDocument()
  })
})
