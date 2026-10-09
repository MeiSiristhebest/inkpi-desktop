import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SafeGateView } from './SafeGateView'

const SAMPLE_TEXT =
  '林枫手持利刃杀入敌阵，刹那间血肉横飞，场面开膛破肚惨不忍睹。后方政府与公安局的飞舟正在赶来。'

describe('SafeGateView — 敏感词审查与文学平替主视口', () => {
  it('waits for author text instead of scanning demo text as project content', () => {
    render(<SafeGateView projectId="p1" />)
    expect(screen.getByText('三级敏感词审查与文学平替')).toBeInTheDocument()
    expect(screen.getByText('等待正文')).toBeInTheDocument()
    expect(screen.getByText('输入或选择章节正文后开始检测')).toBeInTheDocument()
    expect(screen.queryByText(/命中「/)).not.toBeInTheDocument()
  })

  it('filters violations when level filter button is clicked', () => {
    render(<SafeGateView projectId="p1" />)

    fireEvent.change(screen.getByRole('textbox'), { target: { value: SAMPLE_TEXT } })

    // 点击只查看黄线
    fireEvent.click(screen.getByRole('button', { name: /黄线 \(/ }))
    expect(screen.getAllByText(/命中「血肉横飞」/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/命中「政府」/)).not.toBeInTheDocument()
  })

  it('performs one-click batch literary replacement', () => {
    render(<SafeGateView projectId="p1" />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: SAMPLE_TEXT } })
    expect(screen.getByText('一键文学平替')).toBeInTheDocument()

    fireEvent.click(screen.getByText('一键文学平替'))
    // 平替后原词消失，出现合规状态
    expect(screen.getByText('此分类下无敏感风险')).toBeInTheDocument()
    expect(screen.getByText('未命中本地词库')).toBeInTheDocument()
  })
})
