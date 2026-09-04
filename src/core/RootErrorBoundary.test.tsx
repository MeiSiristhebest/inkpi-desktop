import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { RootErrorBoundary } from './RootErrorBoundary'

// 在 effect 中抛错：错误可被错误边界捕获，且不会触发 React 19 并发渲染的自动恢复竞态
const EffectBoom = () => {
  useEffect(() => {
    throw new Error('effect-boom')
  }, [])
  return <div>不会显示</div>
}

describe('RootErrorBoundary — 全局兜底错误边界', () => {
  it('captures render/effect errors and shows a readable card (no white screen)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <RootErrorBoundary>
        <EffectBoom />
      </RootErrorBoundary>,
    )
    expect(screen.getByText('应用遇到未捕获的错误')).toBeInTheDocument()
    expect(screen.getByText(/effect-boom/)).toBeInTheDocument()
    // 提供恢复手段
    expect(screen.getByText('重试')).toBeInTheDocument()
    expect(screen.getByText('重新加载')).toBeInTheDocument()
    spy.mockRestore()
  })

  it('captures uncaught window error events (e.g. event-handler throws)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <RootErrorBoundary>
        <div>正常内容</div>
      </RootErrorBoundary>,
    )
    const ev = new ErrorEvent('error', { error: new Error('handler-boom') })
    window.dispatchEvent(ev)

    expect(await screen.findByText('应用遇到未捕获的错误')).toBeInTheDocument()
    expect(screen.getByText(/handler-boom/)).toBeInTheDocument()
    spy.mockRestore()
  })

  it('captures unhandled promise rejections (e.g. async IndexedDB / network failure)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <RootErrorBoundary>
        <div>正常内容</div>
      </RootErrorBoundary>,
    )
    const ev: any = new Event('unhandledrejection')
    ev.reason = new Error('async-boom')
    window.dispatchEvent(ev)

    expect(await screen.findByText('应用遇到未捕获的错误')).toBeInTheDocument()
    expect(screen.getByText(/async-boom/)).toBeInTheDocument()
    spy.mockRestore()
  })

  it('ignores resource load errors (img/script 404) and keeps rendering children', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <RootErrorBoundary>
        <div>正常内容</div>
      </RootErrorBoundary>,
    )
    // 资源加载错误的 error 为 null，不应触发兜底卡片
    const ev = new ErrorEvent('error', { error: null as any, message: 'Failed to load script' })
    window.dispatchEvent(ev)

    expect(screen.queryByText('应用遇到未捕获的错误')).not.toBeInTheDocument()
    expect(screen.getByText('正常内容')).toBeInTheDocument()
    spy.mockRestore()
  })
})
