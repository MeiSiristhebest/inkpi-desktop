import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ConsistencyDrawer } from './ConsistencyDrawer'
import { indexedDbCodexEntityRepository } from '../../../adapters/indexedDbCodexEntityRepository'
import { indexedDbPowerTierRepository } from '../../../adapters/indexedDbPowerTierRepository'

describe('ConsistencyDrawer — 设定自洽写作随动抽屉', () => {
  beforeEach(async () => {
    await indexedDbPowerTierRepository.delete('p1')
    const all = await indexedDbCodexEntityRepository.getAll()
    await Promise.all(all.map((e) => indexedDbCodexEntityRepository.delete(e.id)))
  })

  it('admits it cannot judge tier inversions when nothing is configured (§P2.4)', () => {
    render(<ConsistencyDrawer projectId="p1" currentText="楚凌霄在洞府打坐修持。" />)
    expect(screen.getByText('设定自洽哨兵')).toBeInTheDocument()
    expect(screen.getByText('未配置阶梯')).toBeInTheDocument()
    expect(screen.getByText('未套用战力阶梯，越阶倒错无法判定')).toBeInTheDocument()
    expect(screen.getByText('未套用战力阶梯，这里只巡检已标注为已故的角色。')).toBeInTheDocument()
    expect(screen.getByTestId('score-provenance')).toHaveTextContent('来源：即时规则')
  })

  it('claims consistency only after a tier system exists to check against', async () => {
    await indexedDbPowerTierRepository.save({
      projectId: 'p1',
      systemName: '两阶体系',
      tiers: ['练气', '筑基'],
      specialModifiers: [],
      updatedAt: 100,
    })

    render(<ConsistencyDrawer projectId="p1" currentText="楚凌霄在洞府打坐修持。" />)

    await waitFor(() => {
      expect(screen.getByText('当前章节战力与设定自洽')).toBeInTheDocument()
    })
    expect(screen.getByText('体系: 2 阶')).toBeInTheDocument()
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
