import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SafeGateView } from './SafeGateView'

describe('SafeGateView — 敏感词审查与文学平替主视口', () => {
  it('renders default demo text and highlights violations', () => {
    render(<SafeGateView projectId="p1" />)
    expect(screen.getByText('三级敏感词审查与文学平替')).toBeInTheDocument()

    // 默认演示文本命中血肉横飞、开膛破肚、政府等
    expect(screen.getAllByText(/黄线告警/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/蓝线建议/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/命中「血肉横飞」/).length).toBeGreaterThan(0)
  })

  it('filters violations when level filter button is clicked', () => {
    render(<SafeGateView projectId="p1" />)

    // 点击只查看黄线
    fireEvent.click(screen.getByRole('button', { name: /黄线 \(/ }))
    expect(screen.getAllByText(/命中「血肉横飞」/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/命中「政府」/)).not.toBeInTheDocument()
  })

  it('performs one-click batch literary replacement', () => {
    render(<SafeGateView projectId="p1" />)
    expect(screen.getByText('一键文学平替')).toBeInTheDocument()

    fireEvent.click(screen.getByText('一键文学平替'))
    // 平替后原词消失，出现合规状态
    expect(screen.getByText('此分类下无敏感风险')).toBeInTheDocument()
    expect(screen.getByText('审查合规')).toBeInTheDocument()
  })
})
