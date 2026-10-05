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

  it('starts with no power system instead of picking a genre for the author (§P2.4)', async () => {
    render(<ConsistencyMasterView projectId="p1" />)
    expect(await screen.findByText('战力阶梯与设定巡检哨兵')).toBeInTheDocument()
    expect(screen.getByText('战力阶梯偏序体系')).toBeInTheDocument()
    // 过去这里会直接渲染 presetTiersData[0]，等于替一本西幻书默认了修真阶梯（INV-05/§P2.4）。
    expect(screen.getByText('未配置：不替本书选流派')).toBeInTheDocument()
    expect(screen.queryByText(/1\. 练气/)).not.toBeInTheDocument()
    // 还没点巡检时，界面不得预先给出「自洽」的结论（INV-09）。
    expect(screen.queryByText(/未发现越阶或吃书矛盾/)).not.toBeInTheDocument()
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
    // 阶梯必须由作者点选（§P2.4）：越阶判定依赖它，不再由界面默认套用。
    fireEvent.click(await screen.findByText(/经典修真九阶/))

    const textarea = await screen.findByPlaceholderText(/练气期的楚凌霄走上前/)
    fireEvent.change(textarea, { target: { value: '楚凌霄一掌秒杀了赵长老！' } })

    const auditBtn = screen.getByText('立即巡检')
    fireEvent.click(auditBtn)

    await waitFor(() => {
      expect(screen.getByText('战力越阶失真')).toBeInTheDocument()
    })
  })
})
