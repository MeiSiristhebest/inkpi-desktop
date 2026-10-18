import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { PaywallSentryMasterView } from './PaywallSentryMasterView'
import { PaywallSentryDrawer } from './PaywallSentryDrawer'
import { indexedDbPaywallAuditRepository as repo } from '../../../adapters/indexedDbPaywallAuditRepository'
vi.mock('../../../adapters/indexedDbProjectRepository', () => ({
  indexedDbProjectRepository: {
    getChaptersByProject: vi.fn().mockResolvedValue([
      {
        id: 'c',
        projectId: 'p',
        volumeId: 'v',
        title: '保存章',
        order: 0,
        content: '谁？',
        revision: 3,
      },
    ]),
    getVolumesByProject: vi.fn().mockResolvedValue([{ id: 'v', projectId: 'p', order: 0 }]),
  },
}))
vi.mock('../../../adapters/indexedDbPaywallAuditRepository', () => ({
  indexedDbPaywallAuditRepository: { save: vi.fn().mockResolvedValue(undefined) },
}))
describe('PaywallSentry components', () => {
  it('uses real book position and stores measured counts separately', async () => {
    render(<PaywallSentryMasterView projectId="p" />)
    await screen.findByText('第 1 章：保存章')
    fireEvent.change(screen.getByLabelText('观察人数'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('付费人数'), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText('观察时期与数据来源'), {
      target: { value: 'synthetic weekly record' },
    })
    expect(screen.getByText(/实测比例：30.00%/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '保存卡点快照' }))
    await waitFor(() =>
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          chapterId: 'c',
          chapterOrder: 1,
          sourceRevision: 3,
          measurement: { reached: 10, paid: 3, rate: 0.3, source: 'synthetic weekly record' },
        }),
      ),
    )
  })
  it('does not show PPI or assumed conversion in the drawer', () => {
    render(<PaywallSentryDrawer projectId="p" currentText="真相尚未揭开。" />)
    expect(screen.getByText('真相尚未揭开。')).toBeInTheDocument()
    expect(screen.queryByText(/PPI/)).not.toBeInTheDocument()
  })
})
