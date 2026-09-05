// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { TestHostHarness } from '../harness'
import { ALL_AVAILABLE_PLUGINS } from '../../../src/core/pluginRegistry'
import { countWords, formatChineseParagraphs } from '../../../src/domain/text'

describe('Tier 1: F2 - Drawer Dock Activation & WriterDesk Consolidation', () => {
  it('TC-DRAWER-01: Manages drawer opening, closing, and toggling in host context', () => {
    const harness = new TestHostHarness('proj-drawer-001')

    expect(harness.activeDrawerPluginId).toBeNull()

    harness.openDrawer('living-codex')
    expect(harness.activeDrawerPluginId).toBe('living-codex')

    harness.toggleDrawer('living-codex')
    expect(harness.activeDrawerPluginId).toBeNull()

    harness.toggleDrawer('living-codex')
    expect(harness.activeDrawerPluginId).toBe('living-codex')

    harness.closeDrawer()
    expect(harness.activeDrawerPluginId).toBeNull()
  })

  it('TC-DRAWER-02: Enforces mutually exclusive drawer rendering (switching plugins)', () => {
    const harness = new TestHostHarness('proj-drawer-002')

    harness.openDrawer('consistency-sentinel')
    expect(harness.activeDrawerPluginId).toBe('consistency-sentinel')

    // Opening another plugin drawer closes the previous one immediately
    harness.openDrawer('water-meter')
    expect(harness.activeDrawerPluginId).toBe('water-meter')

    harness.openDrawer('diff-reviewer')
    expect(harness.activeDrawerPluginId).toBe('diff-reviewer')
  })

  it('TC-DRAWER-03: Verifies plugin registry drawer availability across 39 consolidated plugins', () => {
    expect(ALL_AVAILABLE_PLUGINS.length).toBe(39)

    // Exactly 38 of 39 plugins declare drawerSnippetView (all except timeline-grid)
    const pluginsWithDrawers = ALL_AVAILABLE_PLUGINS.filter((p) => Boolean(p.drawerSnippetView))
    expect(pluginsWithDrawers.length).toBe(38)

    const timelineGridPlugin = ALL_AVAILABLE_PLUGINS.find((p) => p.id === 'timeline-grid')
    expect(timelineGridPlugin?.drawerSnippetView).toBeUndefined()
  })

  it('TC-DRAWER-04: Confirms all drawer snippet components are valid React render functions', () => {
    const pluginsWithDrawers = ALL_AVAILABLE_PLUGINS.filter((p) => Boolean(p.drawerSnippetView))

    for (const plugin of pluginsWithDrawers) {
      // 兼容 React.lazy 动态加载组件（object, $$typeof = Symbol(react.lazy)）与普通 SFC 函数组件
      const isComponent =
        typeof plugin.drawerSnippetView === 'function' ||
        (typeof plugin.drawerSnippetView === 'object' && plugin.drawerSnippetView !== null)
      expect(isComponent).toBe(true)
      expect(plugin.id).toBeDefined()
      expect(plugin.name).toBeDefined()
    }
  })

  it('TC-DRAWER-05: Verifies consolidated text utilities from domain/text (WriterDesk retirement requirement)', () => {
    const rawText = '   楚凌霄   冷笑一声。\n\n\n“你想与我为敌？”   '
    const formatted = formatChineseParagraphs(rawText)

    expect(formatted).toBeDefined()
    expect(formatted.length).toBeGreaterThan(0)

    const count = countWords(rawText)
    expect(count).toBeGreaterThan(0)
  })
})
