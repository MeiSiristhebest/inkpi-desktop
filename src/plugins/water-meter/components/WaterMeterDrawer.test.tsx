import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WaterMeterDrawer } from './WaterMeterDrawer'

describe('WaterMeterDrawer', () => {
  it('renders drawer header and recalculates on input', () => {
    render(<WaterMeterDrawer activeChapterId="ch1" />)
    expect(screen.getByText('正文水分与信息熵')).toBeDefined()
    const textarea = screen.getByPlaceholderText(/粘贴待审文字/)
    fireEvent.change(textarea, {
      target: {
        value: '众人忍不住倒吸了一口凉气，心中暗暗心惊，只觉得自己整个人都不好了。',
      },
    })
    expect(screen.getByText(/捕获水词/)).toBeDefined()
    const cleanBtn = screen.getByText(/一键剔除当前抓捕到的水词/)
    fireEvent.click(cleanBtn)
    expect(screen.getByText(/动词密度/)).toBeDefined()
  })
})
