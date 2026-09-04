import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { PressForgeMasterView } from './PressForgeMasterView'
import { PressForgeDrawer } from './PressForgeDrawer'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import { indexedDbPressConfigRepository } from '../../../adapters/indexedDbPressConfigRepository'

vi.mock('../../../adapters/indexedDbProjectRepository', () => ({
  indexedDbProjectRepository: {
    getChaptersByProject: vi.fn(),
  },
}))

vi.mock('../../../adapters/indexedDbPressConfigRepository', () => ({
  indexedDbPressConfigRepository: {
    get: vi.fn(),
    save: vi.fn(),
  },
}))

describe('PressForge Components', () => {
  const fakeChapters = [
    {
      id: 'ch-1',
      projectId: 'proj-1',
      title: '第一章 启程',
      order: 1,
      content: '测试段落一\n测试段落二',
    },
  ]

  it('renders PressForgeMasterView', async () => {
    vi.mocked(indexedDbProjectRepository.getChaptersByProject).mockResolvedValue(fakeChapters as any)
    vi.mocked(indexedDbPressConfigRepository.get).mockResolvedValue(undefined)

    render(<PressForgeMasterView projectId="proj-1" />)
    expect(screen.getByText(/排版压制与多平台发布工坊/)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText(/目标发布平台预设/)).toBeInTheDocument()
      expect(screen.getByText(/一键复制格式化文本/)).toBeInTheDocument()
    })
  })

  it('renders PressForgeDrawer with formatting stats', async () => {
    render(
      <PressForgeDrawer
        projectId="proj-1"
        currentText="测试段落一\n测试段落二"
      />
    )
    expect(screen.getByText(/标准排版压制/)).toBeInTheDocument()
    expect(screen.getByText(/一键复制标准段首缩进正文/)).toBeInTheDocument()
  })
})
