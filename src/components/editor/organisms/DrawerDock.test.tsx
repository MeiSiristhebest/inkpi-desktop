import React from 'react'
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
      allPlugins: [
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
})
