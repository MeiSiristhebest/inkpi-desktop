import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReaderHookDrawer } from './ReaderHookDrawer'
describe('ReaderHookDrawer', () => {
  it('shows current source and updates without grading reader response', () => {
    const { rerender } = render(<ReaderHookDrawer projectId="p" currentText="旧正文？" />)
    expect(screen.getByText('旧正文？')).toBeInTheDocument()
    rerender(<ReaderHookDrawer projectId="p" currentText="新正文。" />)
    expect(screen.queryByText('旧正文？')).not.toBeInTheDocument()
    expect(screen.getByText('新正文。')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '手动正文。' } })
    expect(screen.getByText('手动正文。', { selector: 'blockquote' })).toBeInTheDocument()
    expect(screen.queryByText(/张力指数/)).not.toBeInTheDocument()
  })
  it('provides optional inspiration', () => {
    render(<ReaderHookDrawer projectId="p" currentText="" />)
    expect(screen.getByText('断章范式灵感')).toBeInTheDocument()
  })
})
