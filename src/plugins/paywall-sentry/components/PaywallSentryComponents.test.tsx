import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { PaywallSentryMasterView } from './PaywallSentryMasterView'
import { PaywallSentryDrawer } from './PaywallSentryDrawer'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'

vi.mock('../../../adapters/indexedDbProjectRepository', () => ({
  indexedDbProjectRepository: {
    getChaptersByProject: vi.fn(),
  },
}))

describe('PaywallSentry Components', () => {
  const fakeChapters = [
    {
      id: 'ch-1',
      projectId: 'proj-1',
      title: '踏入仙途',
      order: 1,
      content: '陆沉看着远方，轰！突然杀意暴涌！那是……',
    },
  ]

  it('renders PaywallSentryMasterView and loads chapters', async () => {
    vi.mocked(indexedDbProjectRepository.getChaptersByProject).mockResolvedValue(fakeChapters as any)
    render(<PaywallSentryMasterView projectId="proj-1" />)
    expect(screen.getByText(/付费卡点与首订转化哨兵/)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText(/踏入仙途/)).toBeInTheDocument()
    })
  })

  it('renders PaywallSentryDrawer for currentText', async () => {
    render(
      <PaywallSentryDrawer
        projectId="proj-1"
        currentText="天劫降临，九霄雷动，那是……"
      />
    )
    expect(screen.getByText(/付费卡点哨兵 \(PPI\)/)).toBeInTheDocument()
    expect(screen.getByText(/PPI 势能评分/)).toBeInTheDocument()
  })
})
