import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ClueWeaverDrawer } from './ClueWeaverDrawer'
import { indexedDbClueWeaverRepository } from '../../../adapters/indexedDbClueWeaverRepository'

vi.mock('../../../adapters/indexedDbClueWeaverRepository', () => ({
  indexedDbClueWeaverRepository: {
    getAllClues: vi.fn().mockResolvedValue([
      {
        id: 'c1',
        projectId: 'p1',
        title: '魔剑秘密',
        category: 'treasure',
        keywords: ['魔剑'],
        status: 'active',
        createdAt: 100,
        updatedAt: 100,
      },
    ]),
    getAllCognitions: vi.fn().mockResolvedValue([]),
  },
}))

describe('ClueWeaverDrawer', () => {
  it('renders drawer header and triggers scan', async () => {
    render(
      <ClueWeaverDrawer
        projectId="p1"
        currentText="林夕说道：“魔剑在哪里？”"
        currentChapterNumber={1}
      />,
    )
    expect(screen.getByText('信息差与全知哨兵')).toBeDefined()
    const btn = screen.getByText('检查当前正文')
    await waitFor(() => expect(btn).toBeEnabled())
    fireEvent.click(btn)
    await waitFor(() => {
      expect(screen.getByText(/未找到匹配候选/)).toBeDefined()
    })
    expect(indexedDbClueWeaverRepository.getAllClues).toHaveBeenCalledWith('p1')
    expect(indexedDbClueWeaverRepository.getAllCognitions).toHaveBeenCalledWith('p1')
  })
  it('invalidates a scan on editor changes and shows load failures', async () => {
    const { rerender } = render(<ClueWeaverDrawer projectId="p1" currentText="正文" />)
    const btn = screen.getByText('检查当前正文')
    await waitFor(() => expect(btn).toBeEnabled())
    fireEvent.click(btn)
    expect(screen.getByText(/未找到匹配候选/)).toBeInTheDocument()
    rerender(<ClueWeaverDrawer projectId="p1" currentText="另一段正文" />)
    expect(screen.queryByText(/未找到匹配候选/)).not.toBeInTheDocument()
    vi.mocked(indexedDbClueWeaverRepository.getAllClues).mockRejectedValueOnce(new Error('failed'))
    rerender(<ClueWeaverDrawer projectId="p2" currentText="正文" />)
    expect(await screen.findByRole('alert')).toHaveTextContent('加载失败')
  })
})
