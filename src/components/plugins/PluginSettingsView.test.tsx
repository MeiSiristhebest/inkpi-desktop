import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PluginSettingsView } from './PluginSettingsView'
import { PluginProvider, usePluginRegistry, CANONICAL_PLUGIN_KEY } from '../../core/pluginRegistry'
import { indexedDbSettingsKVRepository } from '../../adapters/indexedDbSettingsKVRepository'

const renderWithProviders = (ui: React.ReactNode) => render(<PluginProvider>{ui}</PluginProvider>)

describe('PluginSettingsView UI Component', () => {
  beforeEach(async () => {
    localStorage.clear()
    await indexedDbSettingsKVRepository.remove('__global__', CANONICAL_PLUGIN_KEY)
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

  it('toggles plugin off/on and persists to IndexedDB', async () => {
    const Consumer = () => {
      const { isPluginEnabled } = usePluginRegistry()
      return (
        <div data-testid="consumer">{isPluginEnabled('living-codex') ? 'enabled' : 'disabled'}</div>
      )
    }

    renderWithProviders(
      <>
        <PluginSettingsView />
        <Consumer />
      </>,
    )

    // 默认纯粹模式：未启用任何附加插件
    expect(screen.getByTestId('consumer').textContent).toBe('disabled')
    // Canonical plugin state lives in IndexedDB; localStorage is only a legacy
    // migration source and must not be treated as the authority.
    expect(localStorage.getItem('inkpi_enabled_plugins_v2')).toBeNull()

    // 右侧详情抽屉默认选中 living-codex，点击「立即启用此插件」
    fireEvent.click(screen.getByRole('button', { name: '立即启用此插件' }))

    expect(screen.getByTestId('consumer').textContent).toBe('enabled')
    await waitFor(async () => {
      const enabledList = await indexedDbSettingsKVRepository.get<string[]>(
        '__global__',
        CANONICAL_PLUGIN_KEY,
        [],
      )
      expect(enabledList).toContain('living-codex')
    })

    // 再次点击「停用此插件」
    fireEvent.click(screen.getByRole('button', { name: '停用此插件' }))

    expect(screen.getByTestId('consumer').textContent).toBe('disabled')
    await waitFor(async () => {
      const disabledList = await indexedDbSettingsKVRepository.get<string[]>(
        '__global__',
        CANONICAL_PLUGIN_KEY,
        [],
      )
      expect(disabledList).not.toContain('living-codex')
    })
  })
})
