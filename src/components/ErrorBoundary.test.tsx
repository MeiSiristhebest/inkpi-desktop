import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

describe('ErrorBoundary — 防止整页白屏', () => {
  let spy: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    // 屏蔽 React 在捕获错误时打印到控制台的噪音
    spy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    spy.mockRestore()
    cleanup()
  })

  it('正常渲染子组件', () => {
    const Ok = () => <div>正常内容</div>
    render(
      <ErrorBoundary>
        <Ok />
      </ErrorBoundary>,
    )
    expect(screen.getByText('正常内容')).toBeInTheDocument()
  })

  it('捕获子组件抛错并展示可读错误卡片（不再整页白屏）', () => {
    // 在 effect 中抛错：挂载后触发，避免 React 并发渲染的自动恢复干扰断言
    const BoomInEffect = () => {
      useEffect(() => {
        throw new Error('boom-test-error')
      }, [])
      return <div>正常内容</div>
    }
    render(
      <ErrorBoundary label="测试模块">
        <BoomInEffect />
      </ErrorBoundary>,
    )
    // 不再白屏，而是展示错误卡片与具体信息
    expect(screen.getByText(/页面渲染出错/)).toBeInTheDocument()
    expect(screen.getByText('boom-test-error')).toBeInTheDocument()
    // 重试后仍被边界捕获，不会崩溃或回到白屏
    fireEvent.click(screen.getByText('重试'))
    expect(screen.getByText('boom-test-error')).toBeInTheDocument()
  })
})
