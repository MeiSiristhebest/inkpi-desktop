import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

const { connectWebSocketSpy } = vi.hoisted(() => ({
  connectWebSocketSpy: vi.fn(() => new Promise<never>(() => {})),
}))

vi.mock('@inkpi/client', () => ({
  InkRpcClient: {
    connectWebSocket: connectWebSocketSpy,
  },
}))

vi.mock('./core/engine', () => ({
  Engine: ({ isConnected, isReconnecting, onReconnect }: any) => (
    <div data-testid="engine">
      <span data-testid="conn">{isConnected ? 'connected' : 'disconnected'}</span>
      <span data-testid="recon">{isReconnecting ? 'reconnecting' : 'idle'}</span>
      <button data-testid="reconnect-btn" onClick={onReconnect}>
        重连
      </button>
    </div>
  ),
}))

vi.mock('./components/ai/AiAssistantPanel', () => ({
  AiAssistantPanel: () => <div data-testid="ai-panel">AI Panel</div>,
}))

vi.mock('./core/projectService', () => ({
  loadProjects: vi.fn(() => Promise.resolve([{ id: 'test-proj', name: '测试项目', updatedAt: Date.now() }])),
  createProject: vi.fn(),
  importProject: vi.fn(() =>
    Promise.resolve({ ok: true, project: { id: 'imported', name: '导入项目', updatedAt: Date.now() } }),
  ),
}))

vi.mock('./components/bookshelf/Bookshelf', () => ({
  Bookshelf: ({ onOpenProject }: any) => (
    <div data-testid="bookshelf">
      <button data-testid="open-project" onClick={() => onOpenProject('test-proj')}>
        打开项目
      </button>
    </div>
  ),
}))

import { App } from './App'

describe('App daemon connection', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    connectWebSocketSpy.mockClear()
  })

  it('进入离线沙盒模式，不再一直显示「连接中…」', async () => {
    render(<App />)

    // 书架入口：先打开项目才进入 Engine
    await waitFor(() => expect(screen.getByTestId('bookshelf')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('open-project'))
    await waitFor(() => expect(screen.getByTestId('engine')).toBeInTheDocument())

    expect(screen.getByTestId('recon').textContent).toBe('reconnecting')

    // 推进足够时间：15 次尝试 × (5s 连接超时 + 1s 重试间隔) = 90s，多留余量
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100_000)
    })

    await waitFor(() => expect(screen.getByTestId('recon').textContent).toBe('idle'))
    expect(screen.getByTestId('conn').textContent).toBe('disconnected')
  })

  it('重连成功后恢复已连接状态', async () => {
    connectWebSocketSpy.mockImplementationOnce(() =>
      Promise.resolve({
        close: vi.fn().mockResolvedValue(undefined),
        request: vi.fn().mockResolvedValue({ running: true }),
      }),
    )

    render(<App />)

    await waitFor(() => expect(screen.getByTestId('bookshelf')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('open-project'))

    await waitFor(() => expect(screen.getByTestId('conn').textContent).toBe('connected'))
    expect(screen.getByTestId('recon').textContent).toBe('idle')
  })
})
