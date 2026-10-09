import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ExpectationDrawer } from './ExpectationDrawer'
import { indexedDbExpectationRepository } from '../../../adapters/indexedDbExpectationRepository'
import { clock } from '../../../adapters/clock'

describe('ExpectationDrawer — 期待感写作随动抽屉', () => {
  beforeEach(async () => {
    const all = await indexedDbExpectationRepository.getAll()
    await Promise.all(all.map((c) => indexedDbExpectationRepository.delete(c.id)))
  })

  it('renders drawer header and assesses empty text', () => {
    render(<ExpectationDrawer projectId="p1" currentText="" />)
    expect(screen.getByText('期待感与节奏监测')).toBeInTheDocument()
    expect(screen.getByText(/来源：即时规则/)).toBeInTheDocument()
    expect(screen.getByText(/不代表真实读者反馈/)).toBeInTheDocument()
    expect(screen.getByText(/SPR: 1/)).toBeInTheDocument()
    expect(screen.getByText('当前文本未触发节奏阈值提示。')).toBeInTheDocument()
  })

  it('displays suppression warning when chapter is heavy on frustration', () => {
    const heavyText = '屈辱！嘲讽！打压！吐血！命悬一线！敌人冷笑羞辱他是废物！'
    render(<ExpectationDrawer projectId="p1" currentText={heavyText} />)

    expect(
      screen.getByText('规则检测到压抑线索偏多，请核对后续反转或兑现安排。'),
    ).toBeInTheDocument()
  })

  it('loads and lists active contracts', async () => {
    const now = clock.now()
    await indexedDbExpectationRepository.save({
      id: 'c-1',
      projectId: 'p1',
      title: '三年之约决战',
      intensity: 5,
      status: 'building',
      plantedChapter: 1,
      promisedResolveChapter: 30,
      createdAt: now,
      updatedAt: now,
    })

    render(<ExpectationDrawer projectId="p1" currentText="" />)
    expect(await screen.findByText('三年之约决战')).toBeInTheDocument()
  })
})
