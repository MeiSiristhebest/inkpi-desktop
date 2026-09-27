import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ALL_LAZY_PLUGINS, ALL_PLUGIN_DEFINITIONS } from './pluginDefinitions'
import { CAPABILITY_REGISTRY, PLUGIN_DRAWER_CAPABILITY_ORDER } from './capabilityRegistry'
import { capabilityFor } from './capabilityIndex'

/**
 * The sidebar and the command palette both gate on the capability registry, and the registry only
 * covered ten plugins, so thirty-four were unreachable. These assertions are what keeps a fourth
 * hand-maintained list from being needed: the population comes off the disk and the per-plugin facts
 * come off the plugin definitions, so a plugin cannot be missing without failing here.
 */

const curatedIds = new Set(Object.keys(CAPABILITY_REGISTRY))

function pluginDirectories(): string[] {
  return readdirSync(join(__dirname, '../plugins'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

describe('capability coverage', () => {
  it('resolves a capability for every plugin directory on disk', () => {
    const directories = pluginDirectories()
    expect(directories).toHaveLength(44)
    for (const id of directories) {
      expect(capabilityFor(id), id).toBeDefined()
    }
  })

  it('describes every plugin definition with the definition itself, not a second copy', () => {
    for (const definition of ALL_PLUGIN_DEFINITIONS) {
      const capability = capabilityFor(definition.id)
      expect(capability, definition.id).toBeDefined()
      // 名字和说明以前在注册表里抄了第二份，抄到命令面板和侧栏各说一个名字。现在不许抄。
      expect(capability?.name, definition.id).toBe(definition.name)
      expect(capability?.description, definition.id).toBe(definition.description)
      if (curatedIds.has(definition.id)) continue
      expect(capability?.category, definition.id).toBe(definition.category)
    }
  })

  it('derives surfaces from the views a plugin actually ships', () => {
    for (const definition of ALL_PLUGIN_DEFINITIONS) {
      if (curatedIds.has(definition.id)) continue
      const surfaces = capabilityFor(definition.id)?.surfaces ?? []
      expect(surfaces, definition.id).toContain('navigation')
      expect(surfaces, definition.id).toContain('canvas')
      expect(surfaces, definition.id).toContain('command')
      expect(surfaces.includes('drawer')).toBe(Boolean(definition.drawer))
    }
  })

  it('files every drawer under one of the three capability categories (§P2.8)', () => {
    const declared = ALL_PLUGIN_DEFINITIONS.flatMap((definition) =>
      definition.drawer ? [definition.drawer.kind] : [],
    )
    expect(declared.length).toBeGreaterThan(0)
    // 三类都必须真的有抽屉：少一类就说明分组标题已经变成空壳。
    expect(new Set(declared)).toEqual(new Set(PLUGIN_DRAWER_CAPABILITY_ORDER))
    for (const definition of ALL_PLUGIN_DEFINITIONS) {
      if (!definition.drawer) continue
      expect(PLUGIN_DRAWER_CAPABILITY_ORDER, definition.id).toContain(definition.drawer.kind)
    }
    // 工具栏是在「已物化」的插件上挑抽屉的：物化时漏传 kind，声明得再对也不会出现在候选里。
    for (const plugin of ALL_LAZY_PLUGINS) {
      expect(Boolean(plugin.drawerCapability), plugin.id).toBe(Boolean(plugin.drawerSnippetView))
    }
  })

  it('never claims a maturity or a write obligation the source cannot evidence', () => {
    // `maturity` is rendered as a stability badge in the sidebar, so an unearned value would be a
    // presented-as-fact guess — the same class of defect INV-05 forbids for the tier ladder.
    for (const definition of ALL_PLUGIN_DEFINITIONS) {
      if (curatedIds.has(definition.id)) continue
      const capability = capabilityFor(definition.id)
      expect(capability?.maturity, definition.id).toBeUndefined()
      expect(capability?.mutatesDocument, definition.id).toBeUndefined()
      expect(capability?.mutatesCanonicalState, definition.id).toBeUndefined()
    }
  })

  it('keeps curated plugin entries authoritative over derivation', () => {
    // consistency-sentinel is deliberately inspector/drawer/command, without navigation or canvas.
    const sentinel = capabilityFor('consistency-sentinel')
    expect(sentinel?.surfaces).toEqual(['inspector', 'drawer', 'command'])
    expect(sentinel?.maturity).toBe('beta')
  })
})
