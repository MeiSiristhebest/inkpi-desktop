import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FactionMatrixDrawer } from './FactionMatrixDrawer'

vi.mock('../../../adapters/indexedDbCodexEntityRepository', () => ({
  indexedDbCodexEntityRepository: {
    getAll: vi.fn().mockResolvedValue([]),
  },
}))

describe('FactionMatrixDrawer', () => {
  it('renders drawer title and default factions', () => {
    render(<FactionMatrixDrawer projectId="p1" currentText="" />)
    expect(screen.getByText('宗门势力声望')).toBeDefined()
    expect(screen.getByText('玄剑宗')).toBeDefined()
  })
})
