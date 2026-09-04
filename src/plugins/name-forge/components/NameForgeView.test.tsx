import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NameForgeView } from './NameForgeView'
import { clipboardWriter } from '../../../adapters/clipboardWriter'
import { indexedDbCodexEntityRepository } from '../../../adapters/indexedDbCodexEntityRepository'

describe('NameForgeView — 中西奇幻起名姬主视口', () => {
  beforeEach(async () => {
    const all = await indexedDbCodexEntityRepository.getAll()
    await Promise.all(all.map((e) => indexedDbCodexEntityRepository.delete(e.id)))
  })

  it('renders title, categories, and generated names', () => {
    render(<NameForgeView projectId="p1" />)
    expect(screen.getByText('中西奇幻起名姬')).toBeInTheDocument()
    expect(screen.getByText('修仙东方人名')).toBeInTheDocument()
    expect(screen.getByText('西方史诗奇幻')).toBeInTheDocument()
    expect(screen.getByText('重新熔铸锻名')).toBeInTheDocument()
  })

  it('allows switching category to western character names', () => {
    render(<NameForgeView projectId="p1" />)
    fireEvent.click(screen.getByText('西方史诗奇幻'))

    expect(screen.getByText(/当前熔铸品类：西方史诗奇幻/)).toBeInTheDocument()
    expect(screen.getAllByText(/·/).length).toBeGreaterThan(0)
  })

  it('allows saving generated name to Living Codex', async () => {
    render(<NameForgeView projectId="p1" />)

    const saveButtons = screen.getAllByTitle('收录至活体世界观图谱')
    fireEvent.click(saveButtons[0])

    await waitFor(() => {
      expect(screen.getByText('已收录图谱')).toBeInTheDocument()
    })

    const codexEntities = await indexedDbCodexEntityRepository.getAll()
    expect(codexEntities.length).toBe(1)
    expect(codexEntities[0].category).toBe('character')
  })

  it('copies generated name to clipboard', async () => {
    const copySpy = vi.spyOn(clipboardWriter, 'writeText').mockResolvedValue()
    render(<NameForgeView projectId="p1" />)

    const copyButtons = screen.getAllByTitle('复制名称')
    fireEvent.click(copyButtons[0])

    expect(copySpy).toHaveBeenCalled()
    copySpy.mockRestore()
  })
})
