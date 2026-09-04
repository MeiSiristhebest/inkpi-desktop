import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { VolumeMasterDrawer } from './VolumeMasterDrawer'

vi.mock('../../../adapters/indexedDbVolumeArcRepository', () => ({
  indexedDbVolumeArcRepository: {
    getAll: vi.fn().mockResolvedValue([]),
  },
}))

vi.mock('../../../adapters/indexedDbProjectRepository', () => ({
  indexedDbProjectRepository: {
    getVolumesByProject: vi.fn().mockResolvedValue([
      { id: 'vol-1', projectId: 'p1', title: '第一卷 潜龙在渊', order: 0 },
    ]),
    getChaptersByProject: vi.fn().mockResolvedValue([
      { id: 'ch-1', projectId: 'p1', volumeId: 'vol-1', wordCount: 20000 },
    ]),
  },
}))

describe('VolumeMasterDrawer', () => {
  it('renders drawer header and volume stats', async () => {
    render(<VolumeMasterDrawer projectId="p1" currentText="" />)
    await waitFor(() => {
      expect(screen.getByText('分卷宏观罗盘')).toBeDefined()
      expect(screen.getByText('第一卷 潜龙在渊')).toBeDefined()
      expect(screen.getByText(/分卷字数预算/)).toBeDefined()
    })
  })
})
