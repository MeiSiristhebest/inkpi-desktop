import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DialogueDistillerDrawer } from './DialogueDistillerDrawer'
describe('Dialogue drawer', () => {
  it('updates evidence on actual current text changes', () => {
    const { rerender } = render(
      <DialogueDistillerDrawer projectId="p" currentText="甲说：“在哪里？”" />,
    )
    expect(screen.getByPlaceholderText('输入作品中的角色名，以逗号分隔')).toHaveValue('')
    fireEvent.change(screen.getByLabelText('目标角色列表'), { target: { value: '甲' } })
    expect(screen.getByText(/「在哪里？」/)).toBeInTheDocument()
    rerender(<DialogueDistillerDrawer projectId="p" currentText="甲没有说话。" />)
    expect(screen.queryByText(/「在哪里？」/)).not.toBeInTheDocument()
    expect(screen.getByText(/没有可归属的对白/)).toBeInTheDocument()
  })
})
