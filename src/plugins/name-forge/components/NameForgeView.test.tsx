import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NameForgeView } from './NameForgeView'
import { indexedDbCodexEntityRepository as repo } from '../../../adapters/indexedDbCodexEntityRepository'
import { nameForgeEngine } from '../engine/NameForgeEngine'
vi.mock('../../../adapters/indexedDbCodexEntityRepository', () => ({
  indexedDbCodexEntityRepository: { getAll: vi.fn().mockResolvedValue([]) },
}))
vi.mock('../../../services/domainApplicationServices', () => ({
  codexApplicationService: { saveEntity: vi.fn().mockResolvedValue(undefined) },
}))
import { codexApplicationService } from '../../../services/domainApplicationServices'
describe('Naming workspace source and constraints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(repo.getAll).mockResolvedValue([])
  })
  it('preserves author constraints and reserves existing names', async () => {
    vi.mocked(repo.getAll).mockResolvedValue([
      { id: 'known', projectId: 'p', name: '李星', aliases: ['李某'] },
    ] as any)
    const generate = vi.spyOn(nameForgeEngine, 'generateNames')
    render(<NameForgeView projectId="p" />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '生成约束内候选' })).toBeEnabled(),
    )
    fireEvent.change(screen.getByLabelText('固定名称开头'), { target: { value: '李' } })
    fireEvent.change(screen.getByLabelText('固定名称核心'), { target: { value: '星' } })
    fireEvent.change(screen.getByLabelText('名称最长长度'), { target: { value: '4' } })
    fireEvent.click(screen.getByRole('button', { name: '生成约束内候选' }))
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        fixedPrefix: '李',
        fixedKern: '星',
        maxLength: 4,
        excludedNames: expect.arrayContaining(['李星', '李某']),
      }),
    )
    generate.mockRestore()
  })
  it('rechecks collisions before writing a name-only entity', async () => {
    const candidate = {
      id: 'n',
      name: '作者星',
      category: 'character_cn' as const,
      style: 'balanced' as const,
      parts: { prefix: '作者', core: '星' },
      meaningOrVibe: '组合候选',
    }
    vi.spyOn(nameForgeEngine, 'generateNames').mockReturnValueOnce([candidate])
    render(<NameForgeView projectId="p" />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '生成约束内候选' })).toBeEnabled(),
    )
    fireEvent.click(screen.getByRole('button', { name: '生成约束内候选' }))
    vi.mocked(repo.getAll).mockResolvedValue([
      { id: 'existing', projectId: 'p', name: '作者星', aliases: [] },
    ] as any)
    fireEvent.click(screen.getByRole('button', { name: '收录名称草案' }))
    await screen.findByRole('alert')
    expect(codexApplicationService.saveEntity).not.toHaveBeenCalled()
    vi.mocked(repo.getAll).mockResolvedValue([])
    fireEvent.click(screen.getByRole('button', { name: '收录名称草案' }))
    await waitFor(() =>
      expect(codexApplicationService.saveEntity).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'p',
          name: '作者星',
          summary: '',
          detailMarkdown: '',
        }),
        'author-confirmed',
      ),
    )
    const entity = vi.mocked(codexApplicationService.saveEntity).mock.calls.at(-1)![0]
    expect(entity.attributes).not.toHaveProperty('phoneticsScore')
    vi.restoreAllMocks()
  })
})
