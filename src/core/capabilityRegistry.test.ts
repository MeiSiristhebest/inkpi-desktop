import { describe, expect, it } from 'vitest'
import { CAPABILITY_REGISTRY, getCapabilityOverlay } from './capabilityRegistry'
import { capabilityFor } from './capabilityIndex'
import { ALL_PLUGIN_DEFINITIONS } from './pluginDefinitions'
import { TAB_DEFINITIONS } from '../config/tabDefinitions'

describe('CAPABILITY_REGISTRY (P2.1, P2.2, INV-10)', () => {
  it('correctly categorizes production vs beta vs experimental capabilities', () => {
    const codex = getCapabilityOverlay('living-codex')
    expect(codex).toBeDefined()
    expect(codex?.maturity).toBe('production')
    expect(codex?.mutatesCanonicalState).toBe(true)
    expect(codex?.mutatesDocument).toBe(false)

    const diffReviewer = getCapabilityOverlay('diff-reviewer')
    expect(diffReviewer?.maturity).toBe('production')
    expect(diffReviewer?.mutatesDocument).toBe(true)

    const waterMeter = getCapabilityOverlay('water-meter')
    expect(waterMeter?.maturity).toBe('experimental')

    const multiverse = getCapabilityOverlay('multiverse-whatif')
    expect(multiverse?.maturity).toBe('demo')

    const storyboard = getCapabilityOverlay('storyboard-gen')
    expect(storyboard?.surfaces).toContain('navigation')
    expect(storyboard?.mutatesCanonicalState).toBe(false)
  })

  it('declares capability surfaces properly', () => {
    const sentinel = getCapabilityOverlay('consistency-sentinel')
    expect(sentinel?.surfaces).toContain('inspector')
    expect(sentinel?.surfaces).not.toContain('canvas')
  })

  it('maps all domain tab modules from TAB_DEFINITIONS (P1-6)', () => {
    const positioning = getCapabilityOverlay('positioning')
    expect(positioning).toBeDefined()
    expect(positioning?.category).toBe('core')
    expect(positioning?.maturity).toBe('production')

    const master = getCapabilityOverlay('master')
    expect(master?.category).toBe('plot')

    const charMain = getCapabilityOverlay('char-main')
    expect(charMain?.category).toBe('worldbuilding')
    expect(charMain?.surfaces).toContain('drawer')

    const inspireTools = getCapabilityOverlay('inspire-tools')
    expect(inspireTools?.maturity).toBe('beta')
  })

  it('names every capability after the catalog that registers it (P2.14)', () => {
    // 名字写两份就一定会对不上：命令面板曾经说「世界设定集 (Living Codex)」，
    // 侧栏说的是同一个插件的「活体世界观」。
    for (const definition of ALL_PLUGIN_DEFINITIONS) {
      expect(capabilityFor(definition.id)?.name, definition.id).toBe(definition.name)
    }
    const pluginIds = new Set(ALL_PLUGIN_DEFINITIONS.map((definition) => definition.id))
    for (const tab of TAB_DEFINITIONS) {
      if (pluginIds.has(tab.id)) continue
      expect(capabilityFor(tab.id)?.name, tab.id).toBe(tab.name)
    }
  })

  it('keeps the tab/module id overlap to the one the palette already resolves as a plugin', () => {
    // 一个 id 被两份目录各注册一次，命令面板就只能给出不止一个名字对应不上的入口（P2.13 要收的就是它）。
    const pluginIds = new Set(ALL_PLUGIN_DEFINITIONS.map((definition) => definition.id))
    const shared = TAB_DEFINITIONS.map((tab) => tab.id).filter((id) => pluginIds.has(id))
    expect(shared).toEqual(['geography-map'])
  })

  it('registers no capability that a catalog cannot evidence', () => {
    const pluginIds = new Set(ALL_PLUGIN_DEFINITIONS.map((definition) => definition.id))
    const tabIds = new Set(TAB_DEFINITIONS.map((definition) => definition.id))
    const orphans = Object.keys(CAPABILITY_REGISTRY).filter(
      (id) => !pluginIds.has(id) && !tabIds.has(id),
    )
    expect(orphans).toEqual([])
  })
})
