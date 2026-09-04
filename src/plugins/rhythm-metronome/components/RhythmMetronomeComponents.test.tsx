import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { RhythmMetronomeMasterView } from './RhythmMetronomeMasterView'
import { RhythmMetronomeDrawer } from './RhythmMetronomeDrawer'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import { indexedDbRhythmCadenceRepository } from '../../../adapters/indexedDbRhythmCadenceRepository'

vi.mock('../../../adapters/indexedDbProjectRepository', () => ({
  indexedDbProjectRepository: {
    getChaptersByProject: vi.fn().mockResolvedValue([
      { id: 'c1', projectId: 'p1', title: '第1章', content: '开局主角获得逆天造化', order: 1 },
      { id: 'c2', projectId: 'p1', title: '第2章', content: '各方反派围攻山门', order: 2 },
      { id: 'c3', projectId: 'p1', title: '第3章', content: '主角强势反杀绝境逆袭', order: 3 },
    ]),
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

    expect(screen.getByText(/商业网文黄金节拍器与高潮推进节律仪/)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('第 3 章')).toBeInTheDocument()
      expect(screen.getByText(/微循环 \(3章起承高潮\)/)).toBeInTheDocument()
    })

    const saveBtn = screen.getByText('保存节律配置')
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(screen.getByText('网文节奏律动参数已成功保存！')).toBeInTheDocument()
    })
  })

  it('renders RhythmMetronomeDrawer with live cadence progress', async () => {
    render(
      <RhythmMetronomeDrawer
        projectId="p1"
        currentText="天道崩塌，九星连珠，万仙俯首称臣！"
      />
    )

    expect(screen.getByText(/黄金节律随动仪表/)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText(/3章微节拍步频/)).toBeInTheDocument()
      expect(screen.getByText(/15章中循环副本/)).toBeInTheDocument()
    })
  })
})
