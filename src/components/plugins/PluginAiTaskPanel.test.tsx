import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { PluginAiTaskPanel } from './PluginAiTaskPanel'
import { setNavigationHandler } from '../../core/defaultCommands'

describe('PluginAiTaskPanel', () => {
  afterEach(() => {
    cleanup()
    setNavigationHandler(null)
  })

  it('idle 时不占位置', () => {
    const { container } = render(<PluginAiTaskPanel view={{ kind: 'idle' }} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('执行中用可读的状态播报，而不是让按钮看起来卡住', () => {
    render(<PluginAiTaskPanel view={{ kind: 'running' }} />)
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('AI 任务执行中')
    expect(status).toHaveAttribute('aria-live', 'polite')
  })

  it('失败时把消息呈现出来，并提供重试', () => {
    const onRetry = vi.fn()
    render(
      <PluginAiTaskPanel
        view={{ kind: 'failed', message: 'Runtime 未连接', taskId: null }}
        onRetry={onRetry}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Runtime 未连接')
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('没有重试回调时不摆一个按了没反应的按钮', () => {
    render(<PluginAiTaskPanel view={{ kind: 'failed', message: '额度用尽', taskId: 't1' }} />)
    expect(screen.getByRole('alert')).toHaveTextContent('额度用尽')
    expect(screen.queryByRole('button', { name: '重试' })).not.toBeInTheDocument()
  })

  it('结果原样显示，并声明它没有写进正文', () => {
    render(
      <PluginAiTaskPanel
        view={{ kind: 'result', text: '第三章的伏笔在第七章仍未回收', taskId: 't1' }}
      />,
    )

    expect(screen.getByLabelText('AI 任务结果')).toHaveTextContent('第三章的伏笔在第七章仍未回收')
    expect(screen.getByText('未写入正文')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '查看活动中心' })).not.toBeInTheDocument()
  })

  it('routes a persisted plugin result to its activity record', () => {
    const openActivityCenter = vi.fn()
    const openInspector = vi.fn()
    setNavigationHandler({
      openView: vi.fn(),
      openAssistant: vi.fn(),
      openActivityCenter,
      openInspector,
    })
    render(
      <PluginAiTaskPanel
        view={{
          kind: 'result',
          text: '建议继续回收第三章的伏笔',
          taskId: 't2',
          artifactId: 'artifact-t2',
          provenance: { pluginId: 'reader-hook', workspaceId: 'ws-1', taskId: 't2', timestamp: 1 },
        }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '查看活动中心' }))
    expect(openActivityCenter).toHaveBeenCalledWith('artifact-t2')
    expect(openInspector).not.toHaveBeenCalled()
  })
})
