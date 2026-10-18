import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VolumeMasterDrawer } from './VolumeMasterDrawer'
import { DesktopPluginHostContext } from '../../../core/pluginHostContext'
vi.mock('../../../adapters/indexedDbVolumeArcRepository', () => ({
  indexedDbVolumeArcRepository: { getAll: vi.fn().mockResolvedValue([]) },
}))
vi.mock('../../../adapters/indexedDbProjectRepository', () => ({
  indexedDbProjectRepository: {
    getVolumesByProject: vi
      .fn()
      .mockResolvedValue([{ id: 'v', projectId: 'p', title: '当前保存卷', order: 0 }]),
    getChaptersByProject: vi
      .fn()
      .mockResolvedValue([
        { id: 'c', projectId: 'p', volumeId: 'v', order: 0, content: '😀正文', revision: 1 },
      ]),
  },
}))
const wrap = (id: string) => (
  <DesktopPluginHostContext.Provider
    value={
      { projectId: 'p', activeChapter: { id, projectId: 'p', content: '', revision: 1 } } as any
    }
  >
    <VolumeMasterDrawer projectId="p" currentText="" />
  </DesktopPluginHostContext.Provider>
)
describe('Volume drawer source', () => {
  it('uses active saved chapter and does not invent a target or phase', async () => {
    const { rerender } = render(wrap('c'))
    await screen.findByText('当前保存卷')
    expect(screen.getByText(/保存稿 3 \/ 作者预算 未登记/)).toBeInTheDocument()
    expect(screen.getByText('作者阶段：未登记')).toBeInTheDocument()
    rerender(wrap('missing'))
    expect(screen.queryByText('当前保存卷')).not.toBeInTheDocument()
  })
})
