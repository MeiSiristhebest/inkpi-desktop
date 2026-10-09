import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SidebarNav } from './SidebarNav'
import { ALL_AVAILABLE_PLUGINS } from '../../core/pluginRegistry'

describe('SidebarNav workspaces', () => {
  it('routes the five workflow entries to existing tabs and keeps the dashboard reachable', () => {
    const onSelectTab = vi.fn()
    render(
      <SidebarNav
        activeTabId="editor"
        onSelectTab={onSelectTab}
        projectName="Test project"
        onOpenSettings={vi.fn()}
        onOpenCommandPalette={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    const routes = [
      ['正文写作', 'editor'],
      ['大纲', 'volume-master'],
      ['故事', 'living-codex'],
      ['审校', 'gold-chapters-eval'],
      ['素材库', 'scrapbook-recycler'],
    ] as const

    for (const [label, tabId] of routes) {
      fireEvent.click(screen.getByRole('button', { name: label }))
      expect(onSelectTab).toHaveBeenLastCalledWith(tabId)
    }

    fireEvent.click(screen.getByRole('button', { name: '打开写作面板' }))
    expect(onSelectTab).toHaveBeenLastCalledWith('dashboard')
  })

  it('keeps plugin discovery in the command palette instead of the sidebar catalog', () => {
    const plugin = ALL_AVAILABLE_PLUGINS.find((entry) => entry.id === 'multiverse-whatif')
    expect(plugin).toBeDefined()
    const onOpenCommandPalette = vi.fn()

    render(
      <SidebarNav
        activeTabId="editor"
        onSelectTab={vi.fn()}
        projectName="Test project"
        onOpenSettings={vi.fn()}
        onOpenCommandPalette={onOpenCommandPalette}
        onClose={vi.fn()}
      />,
    )

    expect(screen.queryByRole('button', { name: new RegExp(plugin!.name) })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: '搜索插件' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '搜索命令与插件' }))
    expect(onOpenCommandPalette).toHaveBeenCalledOnce()
  })
})
