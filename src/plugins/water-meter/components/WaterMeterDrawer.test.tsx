import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WaterMeterDrawer } from './WaterMeterDrawer'

describe('WaterMeterDrawer', () => {
  it('renders drawer header and recalculates on input', () => {
    render(<WaterMeterDrawer activeChapterId="ch1" />)
    expect(screen.getByText('文本统计与词项复核')).toBeDefined()
    expect(screen.getByText(/来源：即时规则/)).toBeInTheDocument()
    expect(screen.getByText(/不判断文学质量/)).toBeInTheDocument()
    const textarea = screen.getByPlaceholderText(/粘贴待审文字/)
    fireEvent.change(textarea, {
      target: {
        value: '众人忍不住倒吸了一口凉气，心中暗暗心惊，只觉得自己整个人都不好了。',
      },
    })
    expect(screen.getByText(/原文词项/)).toBeDefined()
    const cleanBtn = screen.getAllByRole('button', { name: '移除该处（预览）' })[0]
    fireEvent.click(cleanBtn)
    expect(screen.getByText('动作词表字符占比')).toBeDefined()
    expect(screen.queryByText(/一键剔除|预估可精简/)).not.toBeInTheDocument()
  })
})
