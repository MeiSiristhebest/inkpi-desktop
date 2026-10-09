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
})
