import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { SprintArenaMasterView } from './SprintArenaMasterView'
import { indexedDbSprintRepository } from '../../../adapters/indexedDbSprintRepository'
import { clock } from '../../../adapters/clock'

describe('SprintArenaMasterView — 心流冲刺擂台主视口', () => {
  beforeEach(async () => {
    const all = await indexedDbSprintRepository.getAll()
    await Promise.all(all.map((r) => indexedDbSprintRepository.delete(r.id)))
  })

  it('renders header, stat cards, and empty state', async () => {
    render(<SprintArenaMasterView projectId="p1" />)
    expect(await screen.findByText('心流极速码字冲刺擂台')).toBeInTheDocument()
    expect(screen.getByText('累计冲刺字数')).toBeInTheDocument()
    expect(screen.getByText('历史最高峰值')).toBeInTheDocument()
  })

  it('displays recorded sprints and metrics', async () => {
    const now = clock.now()
    await indexedDbSprintRepository.save({
      id: 's-1',
      projectId: 'p1',
      durationSeconds: 900,
      wordsWritten: 800,
      averageWpm: 53,
      peakWpm: 88,
      completedAt: now,
    })

    render(<SprintArenaMasterView projectId="p1" />)

    await waitFor(() => {
      expect(screen.getByText('+800 字')).toBeInTheDocument()
      expect(screen.getAllByText('88 WPM').length).toBeGreaterThan(0)
    })
  })
})
