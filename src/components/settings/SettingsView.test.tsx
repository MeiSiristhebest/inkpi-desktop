import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, renderHook, act } from '@testing-library/react'
import { SettingsView } from './SettingsView'
import { SettingsProvider } from '../../core/settings'
import { ThemeController } from '../../core/ThemeController'
import { db } from '../../db/indexedDB'

// 与 App 一致的装配：SettingsProvider 提供设置单一来源，ThemeController 负责把主题副作用写到 <html data-theme>。
// 仅渲染 SettingsView 本身不会触发 data-theme 写入（副作用已隔离到 ThemeController）。
const renderSettings = (props: { open: boolean; onClose: () => void }) =>
  render(
    <SettingsProvider>
      <ThemeController />
      <SettingsView open={props.open} onClose={props.onClose} />
    </SettingsProvider>,
  )

const readStored = () => JSON.parse(localStorage.getItem('inkpi-settings') || '{}')

beforeEach(async () => {
  localStorage.clear()
  // 清空 IDB 镜像，避免跨测试串扰
  try {
    await db.delete('settings', 'app')
  } catch {
    /* ignore */
  }
})

afterEach(() => {
  document.documentElement.removeAttribute('data-theme')
})

describe('SettingsView', () => {
  it('外观：切换深色主题会应用到 <html data-theme> 并持久化', async () => {
    renderSettings({ open: true, onClose: vi.fn() })
    fireEvent.click(screen.getByText('深色'))
    await waitFor(() => expect(document.documentElement.getAttribute('data-theme')).toBe('dark'))
    await waitFor(() => expect(readStored().themeMode).toBe('dark'))
  })

  it('编辑器：切换字体族与行距会持久化', async () => {
    renderSettings({ open: true, onClose: vi.fn() })
    fireEvent.click(screen.getByText('编辑器'))
    fireEvent.click(screen.getByText('黑体'))
    fireEvent.click(screen.getByText('1.6'))
    await waitFor(() => {
      const s = readStored()
      expect(s.fontFamily).toBe('sans')
      expect(s.lineHeight).toBe('1.6')
    })
  })

  it('自定义 AI：选择 provider 并手动填写模型 ID，保存后写入 aiModel', async () => {
    renderSettings({ open: true, onClose: vi.fn() })
    fireEvent.click(screen.getByText('自定义 AI 模型'))

    // 点击 DeepSeek 厂商胶囊药丸，自动填充默认 baseUrl
    fireEvent.click(screen.getByText('DeepSeek'))
    await waitFor(() =>
      expect(screen.getByDisplayValue('https://api.deepseek.com/v1')).toBeInTheDocument(),
    )

    // 手动输入模型 ID 与名称
    fireEvent.change(screen.getByPlaceholderText('输入模型 ID 或点击右侧获取'), {
      target: { value: 'deepseek-chat' },
    })
    fireEvent.change(screen.getByPlaceholderText('界面展示名'), { target: { value: 'DeepSeek' } })

    fireEvent.click(screen.getByText('保存配置'))
    await waitFor(() => {
      const s = readStored()
      expect(s.aiModel?.provider).toBe('deepseek')
      expect(s.aiModel?.id).toBe('deepseek-chat')
      expect(s.aiModel?.name).toBe('DeepSeek')
    })
  })

  it('自定义 AI：切换 provider 会自动填入该提供方默认 Base URL', async () => {
    renderSettings({ open: true, onClose: vi.fn() })
    fireEvent.click(screen.getByText('自定义 AI 模型'))

    fireEvent.click(screen.getByText('DeepSeek'))

    await waitFor(() =>
      expect(screen.getByDisplayValue('https://api.deepseek.com/v1')).toBeInTheDocument(),
    )
  })

  it('连接：修改 Daemon 地址会持久化', async () => {
    renderSettings({ open: true, onClose: vi.fn() })
    fireEvent.click(screen.getByText('连接'))
    const input = screen.getByPlaceholderText('ws://127.0.0.1:8849')
    fireEvent.change(input, { target: { value: 'ws://127.0.0.1:9999' } })
    await waitFor(() => expect(readStored().daemonWsUrl).toBe('ws://127.0.0.1:9999'))
  })

  it('编辑器：切换段落缩进方式会持久化到 paragraphIndent', async () => {
    renderSettings({ open: true, onClose: vi.fn() })
    fireEvent.click(screen.getByText('编辑器'))
    fireEvent.click(screen.getByText('两半角空格'))
    await waitFor(() => expect(readStored().paragraphIndent).toBe('space2'))
  })

  it('关于：展示「内置功能一览」而非裸文本', async () => {
    renderSettings({ open: true, onClose: vi.fn() })
    fireEvent.click(screen.getByText('关于'))
    expect(screen.getByText('内置功能一览')).toBeInTheDocument()
    expect(screen.getByText('统一设置中心')).toBeInTheDocument()
  })

  it('关闭按钮触发 onClose', () => {
    const onClose = vi.fn()
    renderSettings({ open: true, onClose })
    fireEvent.click(screen.getByTitle('关闭 (Esc)'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('未打开时不渲染', () => {
    const { container } = renderSettings({ open: false, onClose: vi.fn() })
    expect(container.firstChild).toBeNull()
  })

  it('按 Esc 键触发 onClose', () => {
    const onClose = vi.fn()
    renderSettings({ open: true, onClose })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
import { useSettings } from '../../core/settings'

describe('useSettings', () => {
  it('updates settings within Provider', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SettingsProvider>{children}</SettingsProvider>
    )
    const { result } = renderHook(() => useSettings(), { wrapper })
    act(() => {
      result.current[1]({ fontSize: 20 })
    })
    expect(result.current[0].fontSize).toBe(20)
  })
})
