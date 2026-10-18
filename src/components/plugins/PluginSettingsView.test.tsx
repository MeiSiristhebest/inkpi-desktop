import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PluginSettingsView } from './PluginSettingsView'
import { PluginProvider, usePluginRegistry, CANONICAL_PLUGIN_KEY } from '../../core/pluginRegistry'
import { indexedDbSettingsKVRepository } from '../../adapters/indexedDbSettingsKVRepository'

const renderWithProviders = (ui: React.ReactNode) => render(<PluginProvider>{ui}</PluginProvider>)

describe('PluginSettingsView UI Component', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

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

  it('toggles plugin off/on only after IndexedDB persistence succeeds', async () => {
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

    await waitFor(() =>
      expect(screen.getByRole('switch', { name: '活体世界观 是否启用' })).not.toBeDisabled(),
    )

    // 默认纯粹模式：未启用任何附加插件
    expect(screen.getByTestId('consumer').textContent).toBe('disabled')
    // Canonical plugin state lives in IndexedDB; localStorage is only a legacy
    // migration source and must not be treated as the authority.
    expect(localStorage.getItem('inkpi_enabled_plugins_v2')).toBeNull()

    // 右侧详情抽屉默认选中 living-codex，点击「立即启用此插件」
    const enableButton = screen.getByRole('button', { name: '立即启用此插件' })
    expect(enableButton).toHaveAttribute('data-slot', 'button')
    fireEvent.click(enableButton)

    await waitFor(() => expect(screen.getByTestId('consumer').textContent).toBe('enabled'))
    await waitFor(async () => {
      const enabledList = await indexedDbSettingsKVRepository.get<string[]>(
        '__global__',
        CANONICAL_PLUGIN_KEY,
        [],
      )
      expect(enabledList).toContain('living-codex')
    })

    // 再次点击「停用此插件」
    const disableButton = screen.getByRole('button', { name: '停用此插件' })
    expect(disableButton).toHaveAttribute('data-slot', 'button')
    fireEvent.click(disableButton)

    await waitFor(() => expect(screen.getByTestId('consumer').textContent).toBe('disabled'))
    await waitFor(async () => {
      const disabledList = await indexedDbSettingsKVRepository.get<string[]>(
        '__global__',
        CANONICAL_PLUGIN_KEY,
        [],
      )
      expect(disabledList).not.toContain('living-codex')
    })
  })

  it('keeps the previous switch state and reports a failed settings write', async () => {
    vi.spyOn(indexedDbSettingsKVRepository, 'set').mockRejectedValueOnce(new Error('write denied'))
    renderWithProviders(<PluginSettingsView />)
    const toggle = await screen.findByRole('switch', { name: '活体世界观 是否启用' })
    await waitFor(() => expect(toggle).not.toBeDisabled())

    fireEvent.click(toggle)

    expect(await screen.findByRole('alert')).toHaveTextContent('插件设置保存失败：write denied')
    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })

  it('retries a failed plugin setting write and persists the requested state', async () => {
    const persist = vi
      .spyOn(indexedDbSettingsKVRepository, 'set')
      .mockRejectedValueOnce(new Error('write denied'))
    renderWithProviders(<PluginSettingsView />)
    const toggle = await screen.findByRole('switch', { name: '活体世界观 是否启用' })
    await waitFor(() => expect(toggle).not.toBeDisabled())

    fireEvent.click(toggle)

    expect(await screen.findByRole('alert')).toHaveTextContent('插件设置保存失败：write denied')
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(screen.getByRole('button', { name: '重试保存' }))

    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'))
    await waitFor(async () => {
      const enabledList = await indexedDbSettingsKVRepository.get<string[]>(
        '__global__',
        CANONICAL_PLUGIN_KEY,
        [],
      )
      expect(enabledList).toContain('living-codex')
    })
    expect(persist).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('blocks plugin changes after a settings read failure until reload succeeds', async () => {
    const read = vi
      .spyOn(indexedDbSettingsKVRepository, 'get')
      .mockRejectedValueOnce(new Error('read denied'))
    const persist = vi.spyOn(indexedDbSettingsKVRepository, 'set')
    renderWithProviders(<PluginSettingsView />)
    const toggle = await screen.findByRole('switch', { name: '活体世界观 是否启用' })

    expect(await screen.findByRole('alert')).toHaveTextContent('插件设置读取失败：read denied')
    expect(toggle).toBeDisabled()
    expect(persist).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '重新读取' }))

    await waitFor(() => expect(toggle).not.toBeDisabled())
    expect(read).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('supports keyboard search, plugin selection, switches, and category disclosure', async () => {
    const user = userEvent.setup()
    renderWithProviders(<PluginSettingsView />)

    const searchInput = screen.getByPlaceholderText('搜索已安装插件...')
    await user.type(searchInput, '活体世界观')
    const category = await screen.findByRole('button', { name: /设定与世界书/ })
    const selection = await screen.findByRole('button', { name: /活体世界观/ })
    const toggle = await screen.findByRole('switch', { name: '活体世界观 是否启用' })

    selection.focus()
    await user.keyboard('{Enter}')
    expect(selection).toHaveAttribute('aria-pressed', 'true')

    const wasEnabled = toggle.getAttribute('aria-checked') === 'true'
    toggle.focus()
    await user.keyboard(' ')
    await waitFor(() =>
      expect(toggle).toHaveAttribute('aria-checked', wasEnabled ? 'false' : 'true'),
    )

    category.focus()
    await user.keyboard('{Enter}')
    expect(category).toHaveAttribute('aria-expanded', 'false')
    expect(document.getElementById(category.getAttribute('aria-controls') ?? '')).toHaveAttribute(
      'hidden',
    )
    await user.keyboard('{Enter}')
    expect(category).toHaveAttribute('aria-expanded', 'true')
  })
})
