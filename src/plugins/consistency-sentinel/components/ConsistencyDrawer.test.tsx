import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ConsistencyDrawer } from './ConsistencyDrawer'
import { indexedDbCodexEntityRepository } from '../../../adapters/indexedDbCodexEntityRepository'

describe('ConsistencyDrawer — 设定自洽写作随动抽屉', () => {
  beforeEach(async () => {
    const all = await indexedDbCodexEntityRepository.getAll()
    await Promise.all(all.map((e) => indexedDbCodexEntityRepository.delete(e.id)))
  })

  it('renders drawer header and displays consistent state when clean', () => {
    render(<ConsistencyDrawer projectId="p1" currentText="楚凌霄在洞府打坐修持。" />)
    expect(screen.getByText('设定自洽哨兵')).toBeInTheDocument()
    expect(screen.getByText('当前章节战力与设定自洽')).toBeInTheDocument()
  })

  it('displays critical warning when deceased character acts', async () => {
    // 预存已故角色
    await indexedDbCodexEntityRepository.save({
      id: 'e-dead',
      projectId: 'p1',
      name: '方长老',
      aliases: [],
      category: 'character',
      attributes: { status: 'deceased' },
      relations: [],
      summary: '已阵亡的前代长老',
      createdAt: 100,
      updatedAt: 100,
    })

    const text = '方长老冷笑一声走上前，准备出手。'
    render(<ConsistencyDrawer projectId="p1" currentText={text} />)

    await waitFor(() => {
      expect(screen.getByText(/发现 1 处潜在逻辑吃书/)).toBeInTheDocument()
      expect(screen.getByText('死者复生矛盾')).toBeInTheDocument()
    })
  })
})
