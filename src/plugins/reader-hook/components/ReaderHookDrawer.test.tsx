import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReaderHookDrawer } from './ReaderHookDrawer'

vi.mock('../../../adapters/clipboardWriter', () => ({
  clipboardWriter: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
}))

describe('ReaderHookDrawer', () => {
  it('renders heading and updates score on input', () => {
    render(<ReaderHookDrawer projectId="p1" currentText="" />)
    expect(screen.getByText('章尾断章哨兵')).toBeDefined()
    const textarea = screen.getByPlaceholderText(/快速粘贴正文末尾段落/)
    fireEvent.change(textarea, { target: { value: '只剩最后三息，大阵将破！' } })
    expect(screen.getByText(/张力指数/)).toBeDefined()
  })

  it('renders quick template inspiration cards', () => {
    render(<ReaderHookDrawer projectId="p1" currentText="" />)
    expect(screen.getByText(/断章范式灵感/)).toBeDefined()
  })
})
