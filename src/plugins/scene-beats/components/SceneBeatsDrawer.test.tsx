import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SceneBeatsDrawer } from './SceneBeatsDrawer'
import { DesktopPluginHostContext } from '../../../core/pluginHostContext'
import { indexedDbSceneBeatRepository as repo } from '../../../adapters/indexedDbSceneBeatRepository'
const plan = (id: string, chapterId: string) => ({
  id,
  projectId: 'p',
  chapterId,
  targetWordCount: 4,
  beats: [
    {
      id: id + 'b',
      chapterId,
      order: 0,
      beatType: 'goal' as const,
      title: id,
      goalOrConflict: '作者目标',
      budgetWordRatio: 1,
      isCompleted: false,
    },
  ],
  createdAt: 0,
  updatedAt: 0,
})
vi.mock('../../../adapters/indexedDbSceneBeatRepository', () => ({
  indexedDbSceneBeatRepository: {
    getAll: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
  },
}))
const wrap = (chapterId: string, text: string) => (
  <DesktopPluginHostContext.Provider
    value={
      {
        projectId: 'p',
        activeChapter: { id: chapterId, projectId: 'p', content: '', revision: 1 },
      } as any
    }
  >
    <SceneBeatsDrawer projectId="p" currentText={text} />
  </DesktopPluginHostContext.Provider>
)
describe('Scene drawer binding', () => {
  it('does not use unrelated plans without an actual active chapter', () => {
    render(<SceneBeatsDrawer projectId="p" currentText="😀正文" />)
    expect(screen.getByText(/当前正文未绑定保存章节/)).toBeInTheDocument()
  })
  it('counts actual Unicode text only against its own chapter plan', async () => {
    vi.mocked(repo.getAll).mockResolvedValue([plan('current-plan', 'c'), plan('other-plan', 'd')])
    const { rerender } = render(wrap('c', '😀正文'))
    await screen.findByText(/current-plan：作者目标/)
    expect(screen.queryByText(/other-plan：/)).not.toBeInTheDocument()
    expect(screen.getByText(/正文 3 \/ 预算 4/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '作者标记完成' }))
    await waitFor(() =>
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          chapterId: 'c',
          beats: [expect.objectContaining({ isCompleted: true })],
        }),
      ),
    )
    rerender(wrap('d', '新正文'))
    expect(screen.queryByText(/current-plan：/)).not.toBeInTheDocument()
  })
})
