import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { lazy } from 'react'
import { DrawerDock } from './DrawerDock'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'

const { useOptionalPluginRegistry, useOptionalPluginHostContext } = vi.hoisted(() => ({
  useOptionalPluginRegistry: vi.fn(),
  useOptionalPluginHostContext: vi.fn(),
}))

vi.mock('../../../core/pluginRegistry', () => ({ useOptionalPluginRegistry }))
vi.mock('../../../core/pluginHostContext', () => ({ useOptionalPluginHostContext }))

const DrawerView = ({ currentChapterNumber }: DesktopPluginDrawerProps) => (
  <div>
    Drawer content <span data-testid="drawer-chapter-number">{currentChapterNumber ?? 'none'}</span>
  </div>
)
const PluginIcon = () => null

afterEach(() => vi.restoreAllMocks())

describe('DrawerDock', () => {
  beforeEach(() => {
    useOptionalPluginRegistry.mockReturnValue({
      activePlugins: [
        {
          id: 'test-plugin',
          name: 'Test plugin',
          icon: PluginIcon,
          drawerSnippetView: DrawerView,
        },
      ],
    })
    useOptionalPluginHostContext.mockReturnValue({
      activeDrawerPluginId: 'test-plugin',
      closeDrawer: vi.fn(),
    })
  })

  it('exposes the semantic class and test id on the dock root', () => {
    render(<DrawerDock projectId="project-1" currentText="Current text" />)

    const dock = screen.getByTestId('editor-plugin-drawer-dock')
    expect(dock).toHaveClass('editor-plugin-drawer-dock')
    expect(dock).toHaveAttribute('data-testid', 'editor-plugin-drawer-dock')
  })

  it('names the capability category the open drawer belongs to (§P2.8)', () => {
    useOptionalPluginRegistry.mockReturnValue({
      activePlugins: [
        {
          id: 'test-plugin',
          name: 'Test plugin',
          icon: PluginIcon,
          drawerSnippetView: DrawerView,
          drawerCapability: 'live-diagnostic',
        },
      ],
    })

    render(<DrawerDock projectId="project-1" currentText="Current text" />)

    const badge = screen.getByTestId('editor-plugin-drawer-category')
    expect(badge).toHaveTextContent('实时诊断')
    // 光有名字说明不了这是三类里的哪一类，标题下要跟着那句解释。
    expect(screen.getByText('持续检查当前正文，把问题列成清单')).toBeInTheDocument()
  })

  it('passes the active chapter number to the plugin drawer', () => {
    render(
      <DrawerDock projectId="project-1" currentText="Current text" currentChapterNumber={30} />,
    )

    expect(screen.getByTestId('drawer-chapter-number')).toHaveTextContent('30')
  })

  it('keeps a failed lazy drawer local and retries with a fresh loader', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const failedDrawer = lazy(async () => {
      throw new Error('chunk unavailable')
    })
    const createDrawerSnippetView = vi.fn(() => lazy(async () => ({ default: DrawerView })))
    useOptionalPluginRegistry.mockReturnValue({
      activePlugins: [
        {
          id: 'test-plugin',
          name: 'Test plugin',
          icon: PluginIcon,
          drawerSnippetView: failedDrawer,
          createDrawerSnippetView,
        },
      ],
    })

    render(<DrawerDock projectId="project-1" currentText="Unsaved text" />)

    expect(await screen.findByTestId('editor-plugin-drawer-error')).toHaveTextContent(
      'chunk unavailable',
    )
    fireEvent.click(screen.getByRole('button', { name: '重试插件抽屉' }))

    await waitFor(() => expect(screen.getByText('Drawer content')).toBeInTheDocument())
    expect(createDrawerSnippetView).toHaveBeenCalledTimes(1)
  })

  it('reloads only after the current draft has been saved', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const failedDrawer = lazy(async () => {
      throw new Error('chunk unavailable')
    })
    const createDrawerSnippetView = vi.fn(() => lazy(async () => ({ default: DrawerView })))
    useOptionalPluginRegistry.mockReturnValue({
      activePlugins: [
        {
          id: 'test-plugin',
          name: 'Test plugin',
          icon: PluginIcon,
          drawerSnippetView: failedDrawer,
          createDrawerSnippetView,
        },
      ],
    })

    const events: string[] = []
    const persistDraft = vi.fn(async () => {
      events.push('save')
      return events.filter((event) => event === 'save').length > 1
    })
    const reload = vi.fn(() => events.push('reload'))
    render(
      <DrawerDock
        projectId="project-1"
        currentText="Unsaved text"
        retryAfterLoadError={{ persistDraft, reload }}
      />,
    )

    expect(await screen.findByTestId('editor-plugin-drawer-error')).toHaveTextContent(
      'chunk unavailable',
    )
    const retry = screen.getByRole('button', { name: '保存正文并刷新' })
    expect(retry).toHaveAttribute('data-slot', 'button')

    fireEvent.click(retry)
    await waitFor(() => {
      expect(
        screen
          .getAllByRole('status')
          .some((status) => status.textContent?.includes('正文保存失败，页面未刷新。')),
      ).toBe(true)
    })
    expect(reload).not.toHaveBeenCalled()

    fireEvent.click(retry)
    await waitFor(() => expect(reload).toHaveBeenCalledOnce())
    expect(events).toEqual(['save', 'save', 'reload'])
  })

  it('shows loading feedback while a drawer chunk is pending', () => {
    const pendingDrawer = lazy(() => new Promise<{ default: typeof DrawerView }>(() => {}))
    useOptionalPluginRegistry.mockReturnValue({
      activePlugins: [
        {
          id: 'test-plugin',
          name: 'Test plugin',
          icon: PluginIcon,
          drawerSnippetView: pendingDrawer,
        },
      ],
    })

    render(<DrawerDock projectId="project-1" currentText="Current text" />)

    expect(screen.getByTestId('editor-plugin-drawer-loading')).toHaveTextContent(
      '正在加载Test plugin抽屉',
    )
  })

  it('does not open a drawer for a disabled plugin', () => {
    useOptionalPluginRegistry.mockReturnValue({
      activePlugins: [],
      allPlugins: [
        {
          id: 'test-plugin',
          name: 'Test plugin',
          icon: PluginIcon,
          drawerSnippetView: DrawerView,
        },
      ],
    })

    render(<DrawerDock projectId="project-1" currentText="Current text" />)

    expect(screen.queryByTestId('editor-plugin-drawer-dock')).not.toBeInTheDocument()
  })
})
