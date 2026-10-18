import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { ChekhovRadarMasterView } from './ChekhovRadarMasterView'
import { ChekhovRadarDrawer } from './ChekhovRadarDrawer'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import { indexedDbChekhovGunRepository } from '../../../adapters/indexedDbChekhovGunRepository'
import { pluginEventBus } from '../../../core/pluginEventBus'

vi.mock('../../../adapters/indexedDbProjectRepository', () => ({
  indexedDbProjectRepository: {
    getChaptersByProject: vi.fn().mockResolvedValue(
      Array.from({ length: 50 }, (_, order) => ({
        id: `c-${order}`,
        projectId: 'p1',
        volumeId: 'v',
        title: `第${order + 1}章`,
        content: '',
        order,
      })),
    ),
    getVolumesByProject: vi.fn().mockResolvedValue([{ id: 'v', projectId: 'p1', order: 0 }]),
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
        expectedPayoffChapterOrder: 20,
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
    vi.restoreAllMocks()
    vi.clearAllMocks()
    pluginEventBus.clear()
  })

  it('keeps master-view registration in Chekhov storage without publishing cross-plugin events', async () => {
    const emit = vi.spyOn(pluginEventBus, 'emit')
    render(<ChekhovRadarMasterView projectId="p1" />)

    fireEvent.click(screen.getByText('埋下一柄新枪 (伏笔)'))
    fireEvent.change(screen.getByPlaceholderText('例如：生锈的断剑、神秘青铜古镜'), {
      target: { value: '断刃' },
    })
    fireEvent.click(screen.getByText('确认登记'))

    await waitFor(() => expect(indexedDbChekhovGunRepository.save).toHaveBeenCalled())
    expect(emit).not.toHaveBeenCalled()
  })

  it('keeps drawer quick-plant registration in Chekhov storage without publishing cross-plugin events', async () => {
    const emit = vi.spyOn(pluginEventBus, 'emit')
    render(
      <ChekhovRadarDrawer
        projectId="p1"
        currentChapterNumber={1}
        currentText="主人公拾起一片断刃。"
      />,
    )

    fireEvent.click(await screen.findByText('建立伏笔'))

    await waitFor(() => expect(indexedDbChekhovGunRepository.save).toHaveBeenCalled())
    expect(emit).not.toHaveBeenCalled()
  })

  it('renders ChekhovRadarMasterView and lists rusting gun', async () => {
    render(<ChekhovRadarMasterView projectId="p1" />)

    expect(screen.getByText(/契诃夫之枪与全景伏笔闭合雷达/)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('神秘黑鼎')).toBeInTheDocument()
      expect(screen.getByText(/严重锈蚀警报/)).toBeInTheDocument()
    })

    const fireBtn = screen.getByText('响枪引爆')
    fireEvent.change(screen.getByLabelText('作者兑现说明'), {
      target: { value: '作者已核对黑鼎作用兑现。' },
    })
    fireEvent.click(fireBtn)
    expect(indexedDbChekhovGunRepository.save).toHaveBeenCalled()
  })

  it('renders ChekhovRadarDrawer and detects mentioned gun in current text', async () => {
    render(<ChekhovRadarDrawer projectId="p1" currentText="主角拿出了随身的神秘黑鼎，轰然砸下！" />)

    expect(screen.getByText(/契诃夫伏笔随动感知/)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('神秘黑鼎')).toBeInTheDocument()
      expect(screen.getByText('确认引爆')).toBeInTheDocument()
    })
  })
})
