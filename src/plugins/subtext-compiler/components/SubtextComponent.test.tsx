import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SubtextMasterView } from './SubtextMasterView'
import { SubtextDrawer } from './SubtextDrawer'
import { indexedDbSubtextRepository as repo } from '../../../adapters/indexedDbSubtextRepository'
vi.mock('../../../adapters/indexedDbSubtextRepository', () => ({
  indexedDbSubtextRepository: {
    getAll: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
  },
}))
describe('Subtext author inputs', () => {
  it('does not infer hidden meaning before it is supplied', () => {
    render(<SubtextMasterView projectId="p" />)
    expect(screen.getByRole('button', { name: '归档此对白草稿' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('说话角色名'), { target: { value: '甲' } })
    fireEvent.change(screen.getByLabelText('表面台词'), { target: { value: '明天见。' } })
    expect(screen.getByText('隐藏含义：尚未填写')).toBeInTheDocument()
    expect(screen.queryByText(/防御机制/)).not.toBeInTheDocument()
  })
  it('preserves author goal and meaning on save with failure feedback', async () => {
    vi.mocked(repo.save).mockRejectedValueOnce(new Error('save failed'))
    render(<SubtextMasterView projectId="p" />)
    fireEvent.change(screen.getByLabelText('说话角色名'), { target: { value: '甲' } })
    fireEvent.change(screen.getByLabelText('表面台词'), { target: { value: '明天见。' } })
    fireEvent.change(screen.getByLabelText('说话目标'), { target: { value: '结束谈话' } })
    fireEvent.change(screen.getByLabelText('作者设定的潜台词'), { target: { value: '暂时别问。' } })
    fireEvent.click(screen.getByRole('button', { name: '归档此对白草稿' }))
    await screen.findByRole('alert')
    expect(screen.getByLabelText('表面台词')).toHaveValue('明天见。')
    fireEvent.click(screen.getByRole('button', { name: '归档此对白草稿' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('已保存'))
    expect(repo.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        projectId: 'p',
        goal: '结束谈话',
        subtext: '暂时别问。',
        spoken: '明天见。',
        status: 'author_draft',
      }),
    )
  })
  it('never supplies phantom speech for an empty drawer', () => {
    render(<SubtextDrawer projectId="p" currentText="" />)
    expect(screen.getByText(/没有完整引语，未生成台词或潜台词/)).toBeInTheDocument()
    expect(screen.queryByText('我从来没有在乎过你。')).not.toBeInTheDocument()
  })
})
