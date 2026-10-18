import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ProjectEditForm } from './ProjectEditForm'
import type { ProjectRecord } from '../../../types'

const project: ProjectRecord = {
  id: 'project-1',
  name: '原作品名',
  createdAt: 1,
  updatedAt: 1,
}

describe('ProjectEditForm', () => {
  it('keeps edits visible after a write failure and retries on the next submit', async () => {
    const onSave = vi
      .fn()
      .mockRejectedValueOnce(new Error('write denied'))
      .mockResolvedValueOnce(undefined)
    render(<ProjectEditForm project={project} onCancel={vi.fn()} onSave={onSave} />)
    const nameInput = screen.getByPlaceholderText('请输入作品名称')
    fireEvent.change(nameInput, { target: { value: '新作品名' } })
    fireEvent.click(screen.getByRole('button', { name: '保存作品信息' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '保存失败，编辑内容已保留。write denied',
    )
    expect(nameInput).toHaveValue('新作品名')
    fireEvent.click(screen.getByRole('button', { name: '保存作品信息' }))

    expect(await screen.findByRole('button', { name: '保存作品信息' })).toBeInTheDocument()
    expect(onSave).toHaveBeenCalledTimes(2)
  })
})
