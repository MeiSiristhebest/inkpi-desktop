import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PluginSettingsView } from './PluginSettingsView'
import { PluginProvider, usePluginRegistry, STORAGE_KEY_ENABLED_PLUGINS } from '../../core/pluginRegistry'

const renderWithProviders = (ui: React.ReactNode) =>
  render(<PluginProvider>{ui}</PluginProvider>)

describe('PluginSettingsView UI Component', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders installed plugin list and search', () => {
    renderWithProviders(<PluginSettingsView />)
    expect(screen.getByText('扩展插件管理')).toBeInTheDocument()
    expect(screen.getAllByText('活体世界观').length).toBeGreaterThan(0)
    expect(screen.getByText(/已安装插件/)).toBeInTheDocument()
    expect(screen.queryByText(/官方 6 大黄金套件路线图/)).not.toBeInTheDocument()
  })

  it('filters plugins by search query input', () => {
    renderWithProviders(<PluginSettingsView />)
    const searchInput = screen.getByPlaceholderText('搜索已安装插件...')
    fireEvent.change(searchInput, { target: { value: '世界观' } })
    expect(screen.getAllByText('活体世界观').length).toBeGreaterThan(0)

    fireEvent.change(searchInput, { target: { value: '不存在的插件' } })
    expect(screen.getByText('暂无已安装的插件')).toBeInTheDocument()
  })

  it('toggles plugin off/on and persists to localStorage', () => {
    const Consumer = () => {
      const { isPluginEnabled } = usePluginRegistry()
      return <div data-testid="consumer">{isPluginEnabled('living-codex') ? 'enabled' : 'disabled'}</div>
    }

    renderWithProviders(
      <>
        <PluginSettingsView />
        <Consumer />
      </>,
    )

    expect(screen.getByTestId('consumer').textContent).toBe('enabled')
    expect(localStorage.getItem(STORAGE_KEY_ENABLED_PLUGINS)).toBeNull()

    // 右侧详情抽屉默认已选中 living-codex，点击「停用此插件」
    fireEvent.click(screen.getByRole('button', { name: '停用此插件' }))

    expect(screen.getByTestId('consumer').textContent).toBe('disabled')
    const disabledList = JSON.parse(localStorage.getItem(STORAGE_KEY_ENABLED_PLUGINS) || '[]')
    expect(disabledList).not.toContain('living-codex')

    // 重新启用
    fireEvent.click(screen.getByRole('button', { name: '立即启用此插件' }))

    expect(screen.getByTestId('consumer').textContent).toBe('enabled')
    const enabledList = JSON.parse(localStorage.getItem(STORAGE_KEY_ENABLED_PLUGINS) || '[]')
    expect(enabledList).toContain('living-codex')
  })
})
