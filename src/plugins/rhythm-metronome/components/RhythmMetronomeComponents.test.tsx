import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { RhythmMetronomeMasterView } from './RhythmMetronomeMasterView'
import { RhythmMetronomeDrawer } from './RhythmMetronomeDrawer'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import { indexedDbRhythmCadenceRepository } from '../../../adapters/indexedDbRhythmCadenceRepository'

vi.mock('../../../adapters/indexedDbProjectRepository', () => ({
  indexedDbProjectRepository: {
    getChaptersByProject: vi.fn().mockResolvedValue([
      {
        id: 'c1',
        projectId: 'p1',
        volumeId: 'v',
        title: '第1章',
        content: '开局主角获得逆天造化',
        order: 0,
      },
      {
        id: 'c2',
        projectId: 'p1',
        volumeId: 'v',
        title: '第2章',
        content: '各方反派围攻山门',
        order: 1,
      },
      {
        id: 'c3',
        projectId: 'p1',
        volumeId: 'v',
        title: '第3章',
        content: '主角强势反杀绝境逆袭',
        order: 2,
      },
    ]),
    getVolumesByProject: vi.fn().mockResolvedValue([{ id: 'v', projectId: 'p1', order: 0 }]),
  },
}))

vi.mock('../../../adapters/indexedDbRhythmCadenceRepository', () => ({
  indexedDbRhythmCadenceRepository: {
    get: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
  },
}))

describe('RhythmMetronome Components', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders RhythmMetronomeMasterView and displays cadence beats', async () => {
    render(<RhythmMetronomeMasterView projectId="p1" />)

    expect(screen.getByText('句长统计与章节节律计划')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('已挂卷 3 章；未挂卷 0 条文本。')).toBeInTheDocument()
      expect(screen.getByText('3章短周期计划')).toBeInTheDocument()
      expect(screen.getByLabelText('保存章节的实际句长统计')).toHaveTextContent(
        '开局主角获得逆天造化',
      )
    })

    const saveBtn = screen.getByText('保存节律配置')
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(screen.getByText('节律配置已保存。')).toBeInTheDocument()
      expect(indexedDbRhythmCadenceRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ currentMicroStep: 3, autoDetectEnabled: false }),
      )
    })
  })

  it('renders RhythmMetronomeDrawer with live cadence progress', async () => {
    render(
      <RhythmMetronomeDrawer projectId="p1" currentText="天道崩塌，九星连珠，万仙俯首称臣！" />,
    )

    expect(screen.getByText('当前正文句长统计')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('1 段，1 个标点分句。')).toBeInTheDocument()
      expect(screen.getByText(/天道崩塌，九星连珠，万仙俯首称臣！/)).toBeInTheDocument()
    })
  })
})
