import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { VolumeMasterMasterView } from './VolumeMasterMasterView'
import { indexedDbVolumeArcRepository } from '../../../adapters/indexedDbVolumeArcRepository'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'

vi.mock('../../../adapters/indexedDbVolumeArcRepository', () => ({
  indexedDbVolumeArcRepository: {
    getAll: vi.fn().mockResolvedValue([
      {
        id: 'arc-1',
        projectId: 'p1',
        volumeId: 'vol-1',
        volumeTitle: '第一卷 潜龙在渊',
        volumeOrder: 0,
        targetWordCount: 200000,
        coreConflict: '宗门考核',
        climaxNode: '血煞峰巅峰决战',
        rewardOutcome: '晋升金丹',
        crossVolumeCliffhanger: '未婚妻被掳',
        actStage: 'act1_intro',
        updatedAt: 100,
      },
    ]),
    getByVolumeId: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('../../../adapters/indexedDbProjectRepository', () => ({
  indexedDbProjectRepository: {
    getVolumesByProject: vi.fn().mockResolvedValue([
      { id: 'vol-1', projectId: 'p1', title: '第一卷 潜龙在渊', order: 0 },
    ]),
    getChaptersByProject: vi.fn().mockResolvedValue([
      { id: 'ch-1', projectId: 'p1', volumeId: 'vol-1', wordCount: 15000 },
    ]),
  },
}))

describe('VolumeMasterMasterView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders heading, metric cards, volume list and arc form', async () => {
    render(<VolumeMasterMasterView projectId="p1" />)
    expect(screen.getByText('百万字分卷弧光罗盘')).toBeDefined()
    expect(screen.getByText(/规划分卷总数/)).toBeDefined()
    await waitFor(() => {
      expect(screen.getAllByText(/第一卷 潜龙在渊/).length).toBeGreaterThan(0)
    })
  })

  it('saves volume arc planning upon clicking button', async () => {
    render(<VolumeMasterMasterView projectId="p1" />)
    await waitFor(() => {
      expect(screen.getByText('保存分卷规划')).toBeDefined()
    })
    const saveBtn = screen.getByText('保存分卷规划')
    fireEvent.click(saveBtn)
    await waitFor(() => {
      expect(indexedDbVolumeArcRepository.save).toHaveBeenCalled()
    })
  })
})
