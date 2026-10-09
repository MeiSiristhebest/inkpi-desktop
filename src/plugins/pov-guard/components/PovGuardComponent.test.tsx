import { afterEach, describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PovGuardMasterView } from './PovGuardMasterView'
import { PovGuardDrawer } from './PovGuardDrawer'
import { indexedDbPovGuardRepository } from '../../../adapters/indexedDbPovGuardRepository'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('PovGuard UI Components', () => {
  it('PovGuardMasterView renders correctly', () => {
    render(<PovGuardMasterView projectId="p1" />)
    expect(screen.getByText(/POV 心智防火墙/)).toBeDefined()
    expect(screen.queryByText('心智视界纯正，未检测到视角越界或信息泄露')).not.toBeInTheDocument()
  })

  it('PovGuardDrawer renders correctly with analysis stats', () => {
    render(<PovGuardDrawer projectId="p1" currentText="林凡走在大街上。" />)
    expect(screen.getByText(/POV 心智防火墙/)).toBeDefined()
  })

  it('does not report a clean result when the project has no POV configuration', async () => {
    vi.spyOn(indexedDbPovGuardRepository, 'getAll').mockResolvedValue([])
    render(<PovGuardDrawer projectId="p1" currentText="林凡走在大街上。" />)

    expect(
      await screen.findByText('没有保存的角色与秘密配置，无法进行 POV 规则审查。'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/未检出问题/)).not.toBeInTheDocument()
    expect(screen.queryByText('苏雨柔')).not.toBeInTheDocument()
  })

  it('blocks the master audit when the project has no POV configuration', async () => {
    vi.spyOn(indexedDbPovGuardRepository, 'getAll').mockResolvedValue([])
    render(<PovGuardMasterView projectId="p1" />)
    fireEvent.change(screen.getByPlaceholderText(/输入章节正文/), {
      target: { value: '正文内容' },
    })
    fireEvent.click(screen.getByRole('button', { name: /执行 POV 防火墙审校/ }))

    expect(
      await screen.findByText('没有保存的角色与秘密配置，无法进行 POV 规则审查。'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/未检出问题/)).not.toBeInTheDocument()
  })

  it("saves configured roles, sensitive information, and each role's knowledge", async () => {
    vi.spyOn(indexedDbPovGuardRepository, 'getAll').mockResolvedValue([])
    const save = vi.spyOn(indexedDbPovGuardRepository, 'save').mockResolvedValue()
    render(<PovGuardMasterView projectId="p1" />)

    await screen.findByText('尚未保存 POV 配置。')
    fireEvent.change(screen.getByLabelText('角色名单（每行一个）'), {
      target: { value: '林凡\n苏雨柔' },
    })
    fireEvent.change(screen.getByLabelText('敏感信息（每行一项）'), {
      target: { value: '古戒来历' },
    })
    fireEvent.click(screen.getByRole('checkbox', { name: '林凡 知道：古戒来历' }))
    fireEvent.click(screen.getByRole('button', { name: '保存 POV 配置' }))

    await screen.findByText('POV 配置已保存。')
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'pov-config:p1',
        projectId: 'p1',
        chapterId: '__project_pov_config__',
        povCharacterId: 'pov-character:林凡',
        povCharacterName: '林凡',
        allowedCharacters: [
          {
            characterId: 'pov-character:林凡',
            characterName: '林凡',
            knownSecretIds: ['pov-secret:古戒来历'],
          },
          {
            characterId: 'pov-character:苏雨柔',
            characterName: '苏雨柔',
            knownSecretIds: [],
          },
        ],
        secrets: [
          expect.objectContaining({
            id: 'pov-secret:古戒来历',
            title: '古戒来历',
            confidentialityLevel: 'secret',
            holders: ['林凡'],
          }),
        ],
      }),
    )
  })
})
