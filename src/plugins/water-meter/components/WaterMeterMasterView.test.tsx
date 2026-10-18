import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WaterMeterMasterView } from './WaterMeterMasterView'

describe('WaterMeterMasterView', () => {
  it('renders heading, stat cards and caught water words', () => {
    render(<WaterMeterMasterView projectId="p1" />)
    expect(screen.getByText('文本统计与词项复核')).toBeDefined()
    expect(screen.getByText(/字符频率熵/)).toBeDefined()
    expect(screen.getByText(/动作词表字符占比/)).toBeDefined()
    expect(screen.getByText(/可定位的词项/)).toBeDefined()
    expect(screen.queryByText(/水分综合评分|精炼高能/)).not.toBeInTheDocument()
  })

  it('recalculates actual input and previews removal of only one selected occurrence', () => {
    render(<WaterMeterMasterView projectId="p1" />)
    const editor = screen.getByRole('textbox')
    fireEvent.change(editor, { target: { value: '他忍不住笑了，她忍不住哭了。' } })
    const auditBtn = screen.getByText('重新计算文本统计')
    fireEvent.click(auditBtn)

    const removals = screen.getAllByRole('button', { name: '移除该处词项（预览）' })
    expect(removals).toHaveLength(2)
    fireEvent.click(removals[0])
    expect(editor).toHaveValue('他笑了，她忍不住哭了。')
    expect(screen.getAllByRole('button', { name: '移除该处词项（预览）' })).toHaveLength(1)
  })
})
