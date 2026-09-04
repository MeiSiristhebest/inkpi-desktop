import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { BrainstormSparkMasterView } from './BrainstormSparkMasterView'
import { BrainstormSparkDrawer } from './BrainstormSparkDrawer'
import { indexedDbBrainstormRepository } from '../../../adapters/indexedDbBrainstormRepository'

vi.mock('../../../adapters/indexedDbBrainstormRepository', () => ({
  indexedDbBrainstormRepository: {
    getAll: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}))

describe('BrainstormSpark Components', () => {
  it('renders BrainstormSparkMasterView and shows 8 solutions', async () => {
    render(<BrainstormSparkMasterView projectId="proj-1" />)

    expect(screen.getByText(/灵感火花与困境脱壳破局炉/)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText(/空间置换 \/ 金蝉脱壳/)).toBeInTheDocument()
    })
  })

  it('renders BrainstormSparkDrawer with recommendations', () => {
    render(
      <BrainstormSparkDrawer
        projectId="proj-1"
        currentText="四面大军压境，主角命悬一线！"
      />
    )

    expect(screen.getByText(/写作卡文破局炉/)).toBeInTheDocument()
    expect(screen.getByText(/应急破局脑洞方案/)).toBeInTheDocument()
  })
})
