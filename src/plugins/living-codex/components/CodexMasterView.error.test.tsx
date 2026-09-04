import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// 模拟 IndexedDB 读取失败：验证视图不再白屏，而是展示可读错误与重试
vi.mock('../../../db/indexedDB', () => ({
  db: {
    getAll: vi.fn().mockRejectedValue(new Error('IndexedDB 连接失败')),
    put: vi.fn(),
    delete: vi.fn(),
  },
  uid: (p = 'id') => `${p}-test`,
}))

import { CodexMasterView } from './CodexMasterView'

describe('CodexMasterView — 数据加载容错', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows a readable error + retry button instead of a white screen when DB load fails', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<CodexMasterView projectId="p1" />)

    expect(await screen.findByText('世界观数据加载失败')).toBeInTheDocument()
    expect(screen.getByText(/IndexedDB 连接失败/)).toBeInTheDocument()
    expect(screen.getByText('重试加载')).toBeInTheDocument()

    spy.mockRestore()
  })
})
