import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { ChekhovRadarMasterView } from './ChekhovRadarMasterView'
import { ChekhovRadarDrawer } from './ChekhovRadarDrawer'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import { indexedDbChekhovGunRepository } from '../../../adapters/indexedDbChekhovGunRepository'

vi.mock('../../../adapters/indexedDbProjectRepository', () => ({
  indexedDbProjectRepository: {
    getChaptersByProject: vi.fn().mockResolvedValue([
      { id: 'c1', projectId: 'p1', title: '第1章', content: '', order: 1 },
      { id: 'c50', projectId: 'p1', title: '第50章', content: '', order: 50 },
    ]),
  },
}))

vi.mock('../../../adapters/indexedDbChekhovGunRepository', () => ({
  indexedDbChekhovGunRepository: {
    getAll: vi.fn().mockResolvedValue([
      {
        id: 'gun-1',
        projectId: 'p1',
        gunName: '神秘黑鼎',
        category: 'item',
        status: 'dormant',
        plantChapterOrder: 1,
        plantSnippet: '捡到神秘黑鼎',
        rustingDistance: 49,
        isRustingAlert: true,
        updatedAt: Date.now(),
      },
    ]),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}))

describe('ChekhovRadar Components', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders ChekhovRadarMasterView and lists rusting gun', async () => {
    render(<ChekhovRadarMasterView projectId="p1" />)

    expect(screen.getByText(/契诃夫之枪与全景伏笔闭合雷达/)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('神秘黑鼎')).toBeInTheDocument()
      expect(screen.getByText(/严重锈蚀警报/)).toBeInTheDocument()
    })

    const fireBtn = screen.getByText('响枪引爆')
    fireEvent.click(fireBtn)
    expect(indexedDbChekhovGunRepository.save).toHaveBeenCalled()
  })

  it('renders ChekhovRadarDrawer and detects mentioned gun in current text', async () => {
    render(
      <ChekhovRadarDrawer
        projectId="p1"
        currentText="主角拿出了随身的神秘黑鼎，轰然砸下！"
      />
    )

    expect(screen.getByText(/契诃夫伏笔随动感知/)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('神秘黑鼎')).toBeInTheDocument()
      expect(screen.getByText('确认引爆')).toBeInTheDocument()
    })
  })
})
