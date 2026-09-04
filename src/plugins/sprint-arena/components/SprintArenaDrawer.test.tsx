import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SprintArenaDrawer } from './SprintArenaDrawer'
import { indexedDbSprintRepository } from '../../../adapters/indexedDbSprintRepository'

describe('SprintArenaDrawer — 心流冲刺随动抽屉', () => {
  beforeEach(async () => {
    const all = await indexedDbSprintRepository.getAll()
    await Promise.all(all.map((r) => indexedDbSprintRepository.delete(r.id)))
  })

  it('renders idle state with start sprint controls', () => {
    render(<SprintArenaDrawer projectId="p1" currentText="" />)
    expect(screen.getByText('心流极速码字冲刺')).toBeInTheDocument()
    expect(screen.getByText('开启极速冲刺')).toBeInTheDocument()
    expect(screen.getByText('时间番茄钟')).toBeInTheDocument()
  })

  it('starts and stops sprint smoothly', () => {
    const { rerender } = render(<SprintArenaDrawer projectId="p1" currentText="" />)
    const startBtn = screen.getByText('开启极速冲刺')
    fireEvent.click(startBtn)

    expect(screen.getByText(/冲刺中/)).toBeInTheDocument()

    // 模拟正文新增输入
    rerender(<SprintArenaDrawer projectId="p1" currentText="新码下的一行字" />)

    const finishBtn = screen.getByText('结算')
    fireEvent.click(finishBtn)

    expect(screen.getByText('开启极速冲刺')).toBeInTheDocument()
  })
})
