import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ALL_PLUGIN_DEFINITIONS } from './pluginDefinitions'
import { CAPABILITY_REGISTRY } from './capabilityRegistry'
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
      if (curatedIds.has(definition.id)) continue
      expect(capability?.name).toBe(definition.name)
      expect(capability?.description).toBe(definition.description)
      expect(capability?.category).toBe(definition.category)
    }
  })

  it('derives surfaces from the views a plugin actually ships', () => {
    for (const definition of ALL_PLUGIN_DEFINITIONS) {
      if (curatedIds.has(definition.id)) continue
      const surfaces = capabilityFor(definition.id)?.surfaces ?? []
      expect(surfaces, definition.id).toContain('navigation')
      expect(surfaces, definition.id).toContain('canvas')
      expect(surfaces, definition.id).toContain('command')
      expect(surfaces.includes('drawer')).toBe(Boolean(definition.loadDrawerSnippetView))
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
