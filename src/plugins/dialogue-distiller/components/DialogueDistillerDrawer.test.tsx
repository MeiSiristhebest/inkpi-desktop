import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DialogueDistillerDrawer } from './DialogueDistillerDrawer'

describe('DialogueDistillerDrawer', () => {
  it('renders drawer header and scans dialogue', () => {
    render(<DialogueDistillerDrawer projectId="p1" currentText="" />)
    expect(screen.getByText('角色对白声纹哨兵')).toBeDefined()
    const textarea = screen.getByPlaceholderText(/如：陆沉冷笑道/)
    fireEvent.change(textarea, {
      target: { value: '陆沉冷笑道：“凭你也配向老子出剑？！”' },
    })
    const scanBtn = screen.getByText('测算当前段落角色声纹')
    fireEvent.click(scanBtn)
    expect(screen.getByText(/抓取台词解析结果/)).toBeDefined()
    expect(screen.getByText('陆沉')).toBeDefined()
  })
})
