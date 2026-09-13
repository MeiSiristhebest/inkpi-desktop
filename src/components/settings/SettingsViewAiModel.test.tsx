import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { SettingsView } from './SettingsView'
import { SettingsProvider } from '../../core/settings'
import { ThemeController } from '../../core/ThemeController'
import { db } from '../../db/indexedDB'

vi.mock('../../adapters/modelProviderProbe', () => ({
  probeModelEndpoint: vi.fn(async () => ({ status: 200, latency: 42 })),
  fetchModelIds: vi.fn(async () => ['m-1', 'm-2']),
}))

const renderSettings = (props: { open: boolean; onClose: () => void }) =>
  render(
    <SettingsProvider>
      <ThemeController />
      <SettingsView open={props.open} onClose={props.onClose} />
    </SettingsProvider>,
  )

const readStored = () => JSON.parse(localStorage.getItem('inkpi-settings') || '{}')

const seedTwoProviders = () =>
  localStorage.setItem(
    'inkpi-settings',
    JSON.stringify({
      aiModel: { id: 'deepseek-chat', name: 'DS', provider: 'deepseek' },
      savedAiModels: [
        {
          id: 'deepseek-chat',
          name: 'DS',
          provider: 'deepseek',
          baseUrl: 'https://api.deepseek.com/v1',
        },
        { id: 'gpt-4o', name: 'GPT', provider: 'openai', baseUrl: 'https://api.openai.com/v1' },
      ],
    }),
  )

beforeEach(async () => {
  localStorage.clear()
  try {
    await db.delete('settings', 'app')
  } catch {
    /* ignore */
  }
})

afterEach(() => {
  document.documentElement.removeAttribute('data-theme')
})

describe('AiTab 默认项卡片', () => {
  it('显示当前默认模型，可通过「更改」切换为其他已保存供应商', async () => {
    seedTwoProviders()
    renderSettings({ open: true, onClose: vi.fn() })
    fireEvent.click(screen.getByText('自定义 AI 模型'))

    expect(screen.getByText('默认项')).toBeInTheDocument()
    expect(screen.getByText('deepseek-chat')).toBeInTheDocument()

    // 打开默认模型切换面板并切换到 OpenAI 供应商
    fireEvent.click(screen.getByText('更改'))
    const picker = screen.getByTestId('default-model-picker')
    fireEvent.click(within(picker).getByText('GPT'))

    await waitFor(() => {
      expect(readStored().aiModel?.id).toBe('gpt-4o')
    })
  })
})

describe('AiTab 供应商行内动作', () => {
  it('停用当前默认供应商时自动回退到其他已启用供应商并持久化 enabled 标记', async () => {
    seedTwoProviders()
    renderSettings({ open: true, onClose: vi.fn() })
    fireEvent.click(screen.getByText('自定义 AI 模型'))

    const switches = screen.getAllByRole('switch')
    expect(switches.length).toBe(2)
    fireEvent.click(switches[0]) // 停用第一个（当前默认 deepseek）

    await waitFor(() => {
      const s = readStored()
      expect(s.savedAiModels[0].enabled).toBe(false)
      // 默认模型回退到仍启用的 openai 供应商
      expect(s.aiModel?.id).toBe('gpt-4o')
    })
  })
})

describe('AiTab 添加面板（真实拉取/手动添加 + 目录预填 + 思考等级）', () => {
  it('点击「获取列表」真实拉取模型并预填上下文；思考等级与可用模型快照随保存持久化', async () => {
    renderSettings({ open: true, onClose: vi.fn() })
    fireEvent.click(screen.getByText('自定义 AI 模型'))

    // 点击「添加服务」进入详情视图
    fireEvent.click(screen.getByText('添加服务'))

    // 此时未拉取，显示真实空状态提示，绝无虚假的静态全量模型
    expect(screen.getByText(/填写地址与密钥后，点击上方「获取列表」/)).toBeInTheDocument()

    // 填写端点地址并点击「获取列表」
    fireEvent.change(screen.getByPlaceholderText('https://api.example.com/v1'), {
      target: { value: 'https://api.openai.com/v1' },
    })
    fireEvent.click(screen.getByText('获取列表'))

    // 验证 mock 的真实端点拉取结果 m-1, m-2 出现
    await waitFor(() => {
      expect(screen.getAllByText('m-1').length).toBeGreaterThan(0)
      expect(screen.getAllByText('m-2').length).toBeGreaterThan(0)
    })

    // 在右栏已选卡片内选择思考等级「高」
    const highBtn = screen.getByRole('button', { name: '高' })
    fireEvent.click(highBtn)

    // 保存服务
    fireEvent.click(screen.getByText('保存服务'))

    await waitFor(() => {
      const s = readStored()
      expect(s.aiModel?.thinkingLevel).toBe('xhigh')
      expect(s.aiModel?.supportsThinking).toBe(true)
      expect(s.aiModel?.availableModelIds).toContain('m-1')
      expect(s.savedAiModels?.[0]?.availableModelIds).toContain('m-1')
    })
  })
})

describe('AiTab 模型目录', () => {
  it('展示内置快照规模；「更新模型目录」重新拉取端点模型列表并记录更新时间', async () => {
    seedTwoProviders()
    renderSettings({ open: true, onClose: vi.fn() })
    fireEvent.click(screen.getByText('自定义 AI 模型'))

    // 目录页脚：内置快照 + 数量 + 从未获取
    expect(screen.getByText(/目录：内置快照/)).toBeInTheDocument()
    expect(screen.getByText(/个模型 · 更新于/)).toBeInTheDocument()

    fireEvent.click(screen.getByText('更新模型目录'))

    await waitFor(() => {
      const s = readStored()
      expect(s.savedAiModels?.[0]?.availableModelIds).toEqual(['m-1', 'm-2'])
      expect(s.savedAiModels?.[1]?.availableModelIds).toEqual(['m-1', 'm-2'])
    })

    // 更新时间戳写入本地目录状态
    const meta = JSON.parse(localStorage.getItem('inkpi-ai-catalog-meta') || '{}')
    expect(meta.fetchedAt).toBeTruthy()
    expect(meta.fetchedCount).toBe(2)
  })
})
