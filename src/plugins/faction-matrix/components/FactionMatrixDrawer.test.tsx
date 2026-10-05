import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { FactionMatrixDrawer } from './FactionMatrixDrawer'
import { indexedDbCodexEntityRepository } from '../../../adapters/indexedDbCodexEntityRepository'

vi.mock('../../../adapters/indexedDbCodexEntityRepository', () => ({
  indexedDbCodexEntityRepository: {
    getAll: vi.fn(),
  },
}))

const getAll = vi.mocked(indexedDbCodexEntityRepository.getAll)

const codexFaction = (id: string, name: string) => ({
  id,
  projectId: 'p1',
  name,
  category: 'faction',
  attributes: { reputation: 42 },
})

describe('FactionMatrixDrawer', () => {
  beforeEach(() => {
    getAll.mockReset()
  })

  it('标题存在；设定库为空时给出真实空状态，而不是伪造的势力与声望（P2.3 / INV-05）', async () => {
    getAll.mockResolvedValue([])
    render(<FactionMatrixDrawer projectId="p1" currentText="" />)

    expect(screen.getByText('宗门势力声望')).toBeDefined()
    await waitFor(() => expect(screen.getByText(/^登记势力/)).toHaveTextContent('登记势力: 0'))
    expect(
      screen.getByText(
        '设定库里还没有势力条目。声望天平只显示你自己登记的势力，不用示例数据填充。',
      ),
    ).toBeInTheDocument()
    // 反例锚点：这三条示例势力此前是组件的初始 state，任何真实项目都会先看到它们。
    expect(screen.queryByText('未命名势力')).not.toBeInTheDocument()
    expect(screen.queryByText('未命名势力B')).not.toBeInTheDocument()
    expect(screen.queryByText('未命名势力C')).not.toBeInTheDocument()
  })

  it('只有一个真实势力时也如实显示，不再被示例数据的多寡门槛吞掉', async () => {
    getAll.mockResolvedValue([codexFaction('f-1', '太虚剑派')] as never)
    render(<FactionMatrixDrawer projectId="p1" currentText="" />)

    await waitFor(() => expect(screen.getByText('太虚剑派')).toBeInTheDocument())
    expect(screen.getByText(/^登记势力/)).toHaveTextContent('登记势力: 1')
    // 声望取作者写进设定库的属性，而不是示例里的固定数值。
    expect(screen.getByText(/\+42/)).toBeInTheDocument()
  })

  it('不显示其他项目的势力条目', async () => {
    getAll.mockResolvedValue([
      { ...codexFaction('f-own', '本项目势力'), projectId: 'p1' },
      { ...codexFaction('f-other', '别的项目势力'), projectId: 'p2' },
    ] as never)
    render(<FactionMatrixDrawer projectId="p1" currentText="" />)

    await waitFor(() => expect(screen.getByText('本项目势力')).toBeInTheDocument())
    expect(screen.queryByText('别的项目势力')).not.toBeInTheDocument()
  })
})
