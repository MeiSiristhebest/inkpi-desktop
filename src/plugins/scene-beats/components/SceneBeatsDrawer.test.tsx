import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SceneBeatsDrawer } from './SceneBeatsDrawer'
import { indexedDbSceneBeatRepository } from '../../../adapters/indexedDbSceneBeatRepository'
import { clock } from '../../../adapters/clock'

describe('SceneBeatsDrawer — 细纲节拍写作随动抽屉', () => {
  beforeEach(async () => {
    const all = await indexedDbSceneBeatRepository.getAll()
    await Promise.all(all.map((p) => indexedDbSceneBeatRepository.delete(p.id)))
  })

  it('renders empty prompt when no plan exists and allows initializing default plan', async () => {
    render(<SceneBeatsDrawer projectId="p1" currentText="" />)
    expect(await screen.findByText('当前章节暂无绑定的细纲节拍')).toBeInTheDocument()

    const initBtn = screen.getByText('生成四段式高潮节拍')
    fireEvent.click(initBtn)

    await waitFor(() => {
      expect(screen.getByText(/动机切入与风暴前夕/)).toBeInTheDocument()
      expect(screen.getByText('当前戏')).toBeInTheDocument()
    })
  })

  it('reflects active beat based on currentText length and supports toggling complete', async () => {
    // 预存计划
    const now = clock.now()
    await indexedDbSceneBeatRepository.save({
      id: 'plan-1',
      projectId: 'p1',
      chapterId: 'ch-1',
      targetWordCount: 1000,
      beats: [
        {
          id: 'b1',
          chapterId: 'ch-1',
          order: 0,
          beatType: 'goal',
          title: '初遇强敌',
          goalOrConflict: '主角被围堵',
          budgetWordRatio: 0.5,
          emotionalIn: 0,
          emotionalOut: -0.5,
          isCompleted: false,
        },
        {
          id: 'b2',
          chapterId: 'ch-1',
          order: 1,
          beatType: 'climax',
          title: '绝地反击',
          goalOrConflict: '爆发翻盘',
          budgetWordRatio: 0.5,
          emotionalIn: -0.5,
          emotionalOut: 0.8,
          isCompleted: false,
        },
      ],
      createdAt: now,
      updatedAt: now,
    })

    // 字数 600，应该落入第二节拍 b2
    const currentText = 'a'.repeat(600)
    render(<SceneBeatsDrawer projectId="p1" currentText={currentText} />)

    expect(await screen.findByText(/初遇强敌/)).toBeInTheDocument()
    expect(screen.getByText(/绝地反击/)).toBeInTheDocument()

    // 切换完成状态
    const toggleButtons = screen.getAllByTitle('标记已达成')
    fireEvent.click(toggleButtons[0])

    await waitFor(() => {
      expect(screen.getByTitle('标记未完成')).toBeInTheDocument()
    })
  })
})
