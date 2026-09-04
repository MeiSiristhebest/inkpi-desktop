import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ConsistencyMasterView } from './ConsistencyMasterView'
import { indexedDbPowerTierRepository } from '../../../adapters/indexedDbPowerTierRepository'
import { indexedDbCodexEntityRepository } from '../../../adapters/indexedDbCodexEntityRepository'

describe('ConsistencyMasterView — 战力阶梯与设定巡检哨兵主视口', () => {
  beforeEach(async () => {
    await indexedDbPowerTierRepository.delete('p1')
    const all = await indexedDbCodexEntityRepository.getAll()
    await Promise.all(all.map((e) => indexedDbCodexEntityRepository.delete(e.id)))
  })

  it('renders heading and default tier system', async () => {
    render(<ConsistencyMasterView projectId="p1" />)
    expect(await screen.findByText('战力阶梯与设定巡检哨兵')).toBeInTheDocument()
    expect(screen.getByText('战力阶梯偏序体系')).toBeInTheDocument()
    expect(screen.getByText(/1\. 练气/)).toBeInTheDocument()
  })

  it('allows applying preset and saving tier system', async () => {
    render(<ConsistencyMasterView projectId="p1" />)
    const presetBtn = await screen.findByText(/西方史诗位阶/)
    fireEvent.click(presetBtn)

    expect(screen.getByText(/1\. 黑铁/)).toBeInTheDocument()

    const saveBtn = screen.getByText('保存战力体系')
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(screen.getByText('配置已保存')).toBeInTheDocument()
    })
  })

  it('runs audit on text and detects inversion when no modifier present', async () => {
    // 录入两个实体
    await indexedDbCodexEntityRepository.save({
      id: 'e1',
      projectId: 'p1',
      name: '楚凌霄',
      aliases: [],
      category: 'character',
      attributes: { realm: '练气' },
      relations: [],
      summary: '主角',
      createdAt: 100,
      updatedAt: 100,
    })
    await indexedDbCodexEntityRepository.save({
      id: 'e2',
      projectId: 'p1',
      name: '赵长老',
      aliases: [],
      category: 'character',
      attributes: { realm: '元婴' },
      relations: [],
      summary: '反派',
      createdAt: 100,
      updatedAt: 100,
    })

    render(<ConsistencyMasterView projectId="p1" />)
    const textarea = await screen.findByPlaceholderText(/练气期的楚凌霄走上前/)
    fireEvent.change(textarea, { target: { value: '楚凌霄一掌秒杀了赵长老！' } })

    const auditBtn = screen.getByText('立即巡检')
    fireEvent.click(auditBtn)

    await waitFor(() => {
      expect(screen.getByText('战力越阶失真')).toBeInTheDocument()
    })
  })
})
