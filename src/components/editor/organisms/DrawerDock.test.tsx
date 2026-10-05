import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DrawerDock } from './DrawerDock'

const { useOptionalPluginRegistry, useOptionalPluginHostContext } = vi.hoisted(() => ({
  useOptionalPluginRegistry: vi.fn(),
  useOptionalPluginHostContext: vi.fn(),
}))

vi.mock('../../../core/pluginRegistry', () => ({ useOptionalPluginRegistry }))
vi.mock('../../../core/pluginHostContext', () => ({ useOptionalPluginHostContext }))

const DrawerView = () => <div>Drawer content</div>
const PluginIcon = () => null

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
