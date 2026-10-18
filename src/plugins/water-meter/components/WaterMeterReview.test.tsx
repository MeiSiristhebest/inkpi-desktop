import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WaterMeterDrawer } from './WaterMeterDrawer'

describe('wording review preview', () => {
  it('uses the supplied writing text and removes only the explicitly selected occurrence', () => {
    const text = '他忍不住笑了，她忍不住哭了。'
    render(<WaterMeterDrawer projectId="p1" currentText={text} />)
    const editor = screen.getByRole('textbox')
    expect(editor).toHaveValue(text)
    expect(screen.queryByText(/一键剔除|预估可精简/)).not.toBeInTheDocument()
    const remove = screen.getAllByRole('button', { name: '移除该处（预览）' })
    expect(remove).toHaveLength(2)
    fireEvent.click(remove[0])
    expect(editor).toHaveValue('他笑了，她忍不住哭了。')
    expect(screen.getAllByRole('button', { name: '移除该处（预览）' })).toHaveLength(1)
  })

  it('refreshes when the actual writing text changes and does not issue a quality verdict', () => {
    const view = render(<WaterMeterDrawer projectId="p1" currentText="她在等孩子。" />)
    expect(screen.getByRole('textbox')).toHaveValue('她在等孩子。')
    view.rerender(<WaterMeterDrawer projectId="p1" currentText="她等到了。" />)
    expect(screen.getByRole('textbox')).toHaveValue('她等到了。')
    expect(screen.queryByText(/精炼高能|精炼度极佳|叙事密度良好/)).not.toBeInTheDocument()
  })
})
