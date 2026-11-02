import { cleanup, render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

const { connectWebSocketSpy } = vi.hoisted(() => ({
  connectWebSocketSpy: vi.fn(() => new Promise<never>(() => {})),
}))

vi.mock('@inkpi/client', () => ({
  InkRpcClient: {
    connectWebSocket: connectWebSocketSpy,
  },
}))

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  MotionConfig: ({ children }: any) => <>{children}</>,
}))

vi.mock('./core/engine', () => ({
  Engine: ({ isConnected, isReconnecting, onReconnect, renderInspector }: any) => (
    <div data-testid="engine">
      <span data-testid="conn">{isConnected ? 'connected' : 'disconnected'}</span>
      <span data-testid="recon">{isReconnecting ? 'reconnecting' : 'idle'}</span>
      {renderInspector?.({ surface: 'activity', resultId: 'app-restart-result' }, () => {})}
      <button data-testid="reconnect-btn" onClick={onReconnect}>
        重连
      </button>
    </div>
  ),
}))

vi.mock('./components/ai/AiAssistantPanel', () => ({
  AiAssistantPanel: ({ results = [] }: any) => (
    <output data-testid="ai-panel-results">{JSON.stringify(results)}</output>
  ),
}))

vi.mock('./components/ai/CreativeWorkflowsPanel', () => ({
  CreativeWorkflowsPanel: () => null,
}))

vi.mock('./core/projectService', () => ({
  loadProjects: vi.fn(() =>
    Promise.resolve([{ id: 'test-proj', name: '测试项目', updatedAt: Date.now() }]),
  ),
  loadArchivedProjects: vi.fn(() => Promise.resolve([])),
  loadProjectVolumes: vi.fn(() => Promise.resolve([])),
  createProject: vi.fn(),
  importProject: vi.fn(() =>
    Promise.resolve({
      ok: true,
      project: { id: 'imported', name: '导入项目', updatedAt: Date.now() },
    }),
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
import { db } from './db/indexedDB'
import { IndexedDbArtifactStore, type AiArtifact } from './ai/artifacts/artifactStore'
import {
  DESKTOP_REQUIRED_RUNTIME_CAPABILITIES,
  RUNTIME_CONTRACT_VERSION,
  RUNTIME_PROTOCOL_VERSION,
  RUNTIME_SCHEMA_HASH,
} from '@inkpi/protocol'
import runtimeLock from '../runtime.lock.json'

describe('App daemon connection', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    connectWebSocketSpy.mockReset()
    connectWebSocketSpy.mockImplementation(() => new Promise<never>(() => {}))
  })

  afterEach(() => {
    cleanup()
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
        request: vi.fn().mockImplementation(async (method: string) => {
          if (method === 'runtime.handshake') {
            return {
              accepted: true,
              protocolVersion: RUNTIME_PROTOCOL_VERSION,
              contractVersion: RUNTIME_CONTRACT_VERSION,
              schemaHash: RUNTIME_SCHEMA_HASH,
              runtimeVersion: '1.0.0',
              runtimeCommit: runtimeLock.pinnedCommit,
              rpcMethods: [...DESKTOP_REQUIRED_RUNTIME_CAPABILITIES],
              capabilities: [...DESKTOP_REQUIRED_RUNTIME_CAPABILITIES],
              skillManifestHash: runtimeLock.skillManifestHash,
              storageSchemaVersion: runtimeLock.storageSchemaVersion,
              missingCapabilities: [],
              missingRpcMethods: [],
            }
          }
          if (method === 'artifact.list') return []
          if (method === 'domain.sync.pull') return []
          if (method === 'domain.sync.snapshot') {
            return { workspaceId: 'test-proj', revision: 0, changeSets: [], createdAt: 0 }
          }
          if (method === 'skill.status') return { activatedSkills: [] }
          if (method === 'skill.activate') {
            return {
              snapshot: {
                activatedSkills: ['hook', 'promise', 'character-voice', 'timeline-consistency'],
              },
            }
          }
          return { running: true }
        }),
      }),
    )

    render(<App />)

    await waitFor(() => expect(screen.getByTestId('bookshelf')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('open-project'))

    await waitFor(() => expect(screen.getByTestId('conn').textContent).toBe('connected'))
    expect(screen.getByTestId('recon').textContent).toBe('idle')
  })

  it('restores an IndexedDB artifact through App startup into the Activity Center', async () => {
    const artifact: AiArtifact = {
      id: 'app-restart-result',
      taskId: 'app-restart-result-task',
      kind: 'narrative.continuity.audit',
      type: 'creative.audit-report',
      version: 1,
      documentId: 'app-restart-chapter',
      content: { summary: '恢复后的本地结果' },
      provenance: { sourceRevision: 4 },
      ownership: { owner: 'desktop', authoritative: true, workspaceId: 'test-proj' },
      metadata: { title: '恢复结果' },
      createdAt: 100,
      updatedAt: 100,
    }
    const store = new IndexedDbArtifactStore()
    await store.save(artifact)

    try {
      await expect(store.listByWorkspace('test-proj')).resolves.toEqual(
        expect.arrayContaining([expect.objectContaining({ id: artifact.id })]),
      )
      connectWebSocketSpy.mockRejectedValue(new Error('offline for test'))
      render(<App />)
      await waitFor(() => expect(screen.getByTestId('bookshelf')).toBeInTheDocument())
      fireEvent.click(screen.getByTestId('open-project'))

      await waitFor(() => expect(screen.getByTestId('conn')).toHaveTextContent('disconnected'))
      await waitFor(() => {
        const activityResults = screen.getByTestId('ai-panel-results').textContent ?? ''
        expect(activityResults).toContain(artifact.id)
        expect(activityResults).toContain('恢复后的本地结果')
      })
    } finally {
      await db.delete('aiArtifacts', artifact.id)
    }
  })
})
