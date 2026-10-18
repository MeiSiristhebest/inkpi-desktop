import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NameForgeDrawer } from './NameForgeDrawer'
import { nameForgeEngine } from '../engine/NameForgeEngine'
import { clipboardWriter } from '../../../adapters/clipboardWriter'
describe('Naming drawer', () => {
  it('waits for author generation and hides results after constraints change', () => {
    vi.spyOn(nameForgeEngine, 'generateNames').mockReturnValueOnce([
      {
        id: 'n',
        name: '作者星',
        category: 'character_cn',
        style: 'balanced',
        parts: { prefix: '作者', core: '星' },
        meaningOrVibe: '候选',
      },
    ])
    render(<NameForgeDrawer projectId="p" currentText="" />)
    expect(screen.queryByRole('button', { name: '复制名称' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '生成命名候选' }))
    expect(screen.getByText('作者星')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('侧栏固定开头'), { target: { value: '另一个' } })
    expect(screen.queryByText('作者星')).not.toBeInTheDocument()
    vi.restoreAllMocks()
  })
  it('copies a real returned candidate with visible success', async () => {
    const copy = vi.spyOn(clipboardWriter, 'writeText').mockResolvedValue(undefined)
    render(<NameForgeDrawer projectId="p" currentText="" />)
    fireEvent.click(screen.getByRole('button', { name: '生成命名候选' }))
    fireEvent.click(screen.getAllByRole('button', { name: '复制名称' })[0])
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('已复制'))
    expect(copy).toHaveBeenCalled()
    copy.mockRestore()
  })
})
