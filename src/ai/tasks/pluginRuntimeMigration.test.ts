// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ALL_PLUGIN_DEFINITIONS } from '../../core/pluginDefinitions'
import { ALL_AVAILABLE_PLUGINS } from '../../core/pluginRegistry'
import { listPluginInstructionDefinitions } from '../instructions/pluginInstructions'
import { FIRST_PARTY_PLUGIN_IDS, type FirstPartyPluginId } from './pluginCatalog'
import {
  PLUGIN_RUNTIME_CATALOG,
  type PluginRuntimeClass,
  type PluginRuntimeTarget,
} from './pluginRuntimeCatalog'

type MigrationDisposition =
  | 'migrated-to-runtime'
  | 'desktop-local-by-design'
  | 'classification-only'

interface BoundaryExpectation {
  runtimeClass: PluginRuntimeClass
  runtimeTarget: PluginRuntimeTarget
  disposition: MigrationDisposition
}

/**
 * Phase 20 decision record. `classification-only` is intentional: the
 * Desktop catalog names the future Runtime target, but no task/context
 * registration is claimed for those plugins by this test.
 */
const EXPECTED_BOUNDARIES = {
  'aftermath-sync': {
    runtimeClass: 'pure-local',
    runtimeTarget: 'desktop-local-engine',
    disposition: 'desktop-local-by-design',
  },
  'archetype-cards': {
    runtimeClass: 'pure-local',
    runtimeTarget: 'desktop-local-engine',
    disposition: 'desktop-local-by-design',
  },
  'author-ops': {
    runtimeClass: 'pure-local',
    runtimeTarget: 'desktop-local-engine',
    disposition: 'desktop-local-by-design',
  },
  'brainstorm-spark': {
    runtimeClass: 'pure-local',
    runtimeTarget: 'desktop-local-engine',
    disposition: 'desktop-local-by-design',
  },
  'chekhov-radar': {
    runtimeClass: 'ai-task',
    runtimeTarget: 'creative-task',
    disposition: 'migrated-to-runtime',
  },
  'clue-weaver': {
    runtimeClass: 'ai-task',
    runtimeTarget: 'creative-task',
    disposition: 'migrated-to-runtime',
  },
  'combat-sandbox': {
    runtimeClass: 'ai-task',
    runtimeTarget: 'creative-task',
    disposition: 'migrated-to-runtime',
  },
  'consistency-sentinel': {
    runtimeClass: 'hybrid',
    runtimeTarget: 'creative-task-and-story-context',
    disposition: 'migrated-to-runtime',
  },
  'describe-palette': {
    runtimeClass: 'pure-local',
    runtimeTarget: 'desktop-local-engine',
    disposition: 'desktop-local-by-design',
  },
  'dialogue-distiller': {
    runtimeClass: 'ai-task',
    runtimeTarget: 'creative-task',
    disposition: 'migrated-to-runtime',
  },
  'diff-reviewer': {
    runtimeClass: 'tool',
    runtimeTarget: 'extension-tool',
    disposition: 'classification-only',
  },
  'emotion-curve': {
    runtimeClass: 'ai-task',
    runtimeTarget: 'creative-task',
    disposition: 'migrated-to-runtime',
  },
  'expectation-engine': {
    runtimeClass: 'ai-task',
    runtimeTarget: 'creative-task',
    disposition: 'migrated-to-runtime',
  },
  'faction-matrix': {
    runtimeClass: 'ai-task',
    runtimeTarget: 'creative-task',
    disposition: 'migrated-to-runtime',
  },
  'geography-map': {
    runtimeClass: 'pure-local',
    runtimeTarget: 'desktop-local-engine',
    disposition: 'desktop-local-by-design',
  },
  'gold-chapters-eval': {
    runtimeClass: 'ai-task',
    runtimeTarget: 'creative-task',
    disposition: 'migrated-to-runtime',
  },
  'iron-chamber': {
    runtimeClass: 'pure-local',
    runtimeTarget: 'desktop-local-engine',
    disposition: 'desktop-local-by-design',
  },
  'living-codex': {
    runtimeClass: 'context-provider',
    runtimeTarget: 'story-context-compiler',
    disposition: 'migrated-to-runtime',
  },
  'memory-palace': {
    runtimeClass: 'tool',
    runtimeTarget: 'extension-tool',
    disposition: 'classification-only',
  },
  'multi-calendar': {
    runtimeClass: 'ai-task',
    runtimeTarget: 'creative-task',
    disposition: 'migrated-to-runtime',
  },
  'multiverse-whatif': {
    runtimeClass: 'workflow',
    runtimeTarget: 'runtime-workflow',
    disposition: 'classification-only',
  },
  'name-forge': {
    runtimeClass: 'pure-local',
    runtimeTarget: 'desktop-local-engine',
    disposition: 'desktop-local-by-design',
  },
  'narrative-linter': {
    runtimeClass: 'ai-task',
    runtimeTarget: 'creative-task',
    disposition: 'migrated-to-runtime',
  },
  'paywall-sentry': {
    runtimeClass: 'ai-task',
    runtimeTarget: 'creative-task',
    disposition: 'migrated-to-runtime',
  },
  'pov-guard': {
    runtimeClass: 'pure-local',
    runtimeTarget: 'desktop-local-engine',
    disposition: 'desktop-local-by-design',
  },
  'press-forge': {
    runtimeClass: 'tool',
    runtimeTarget: 'extension-tool',
    disposition: 'classification-only',
  },
  'promise-ledger': {
    runtimeClass: 'ai-task',
    runtimeTarget: 'creative-task',
    disposition: 'migrated-to-runtime',
  },
  'reader-hook': {
    runtimeClass: 'ai-task',
    runtimeTarget: 'creative-task',
    disposition: 'migrated-to-runtime',
  },
  'reader-simulator': {
    runtimeClass: 'ai-task',
    runtimeTarget: 'creative-task',
    disposition: 'migrated-to-runtime',
  },
  'rhythm-metronome': {
    runtimeClass: 'pure-local',
    runtimeTarget: 'desktop-local-engine',
    disposition: 'desktop-local-by-design',
  },
  'rhythm-radar': {
    runtimeClass: 'pure-local',
    runtimeTarget: 'desktop-local-engine',
    disposition: 'desktop-local-by-design',
  },
  'safe-gate': {
    runtimeClass: 'ai-task',
    runtimeTarget: 'creative-task',
    disposition: 'migrated-to-runtime',
  },
  'scene-beats': {
    runtimeClass: 'ai-task',
    runtimeTarget: 'creative-task',
    disposition: 'migrated-to-runtime',
  },
  'scrapbook-recycler': {
    runtimeClass: 'tool',
    runtimeTarget: 'extension-tool',
    disposition: 'classification-only',
  },
  'shadow-reader': {
    runtimeClass: 'pure-local',
    runtimeTarget: 'desktop-local-engine',
    disposition: 'desktop-local-by-design',
  },
  'soundscape': {
    runtimeClass: 'ui-only',
    runtimeTarget: 'desktop-ui',
    disposition: 'desktop-local-by-design',
  },
  'sprint-arena': {
    runtimeClass: 'ui-only',
    runtimeTarget: 'desktop-ui',
    disposition: 'desktop-local-by-design',
  },
  'storyboard-gen': {
    runtimeClass: 'workflow',
    runtimeTarget: 'runtime-workflow',
    disposition: 'classification-only',
  },
  'sub-plot-braid': {
    runtimeClass: 'ai-task',
    runtimeTarget: 'creative-task',
    disposition: 'migrated-to-runtime',
  },
  'subtext-compiler': {
    runtimeClass: 'ai-task',
    runtimeTarget: 'creative-task',
    disposition: 'migrated-to-runtime',
  },
  'timeline-grid': {
    runtimeClass: 'ai-task',
    runtimeTarget: 'creative-task',
    disposition: 'migrated-to-runtime',
  },
  'voice-preview': {
    runtimeClass: 'ui-only',
    runtimeTarget: 'desktop-ui',
    disposition: 'desktop-local-by-design',
  },
  'volume-master': {
    runtimeClass: 'ai-task',
    runtimeTarget: 'creative-task',
    disposition: 'migrated-to-runtime',
  },
  'water-meter': {
    runtimeClass: 'ai-task',
    runtimeTarget: 'creative-task',
    disposition: 'migrated-to-runtime',
  },
} satisfies Record<FirstPartyPluginId, BoundaryExpectation>

const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PLUGIN_ROOT = join(SRC_ROOT, 'plugins')
const DEFINITION_FILE = join(SRC_ROOT, 'core', 'pluginDefinitions.ts')
const HOST_CONTEXT_FILE = join(SRC_ROOT, 'core', 'pluginHostContext.tsx')
const SOURCE_FILE = /\.(?:ts|tsx)$/
const TEST_FILE = /(?:\.test|\.spec)\.(?:ts|tsx)$/

function walk(root: string): string[] {
  const files: string[] = []
  for (const name of readdirSync(root)) {
    const file = join(root, name)
    if (name === 'node_modules' || name === '.git') continue
    if (statSync(file).isDirectory()) {
      files.push(...walk(file))
    } else if (SOURCE_FILE.test(name)) {
      files.push(file)
    }
  }
  return files
}

function implementationFiles(root: string): string[] {
  return walk(root).filter((file) => !TEST_FILE.test(file))
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

function pluginEvidence(pluginId: FirstPartyPluginId) {
  const directory = join(PLUGIN_ROOT, pluginId)
  const files = existsSync(directory) ? implementationFiles(directory) : []
  const source = stripComments(files.map((file) => readFileSync(file, 'utf8')).join('\n'))
  const taskInvocations = [
    ...source.matchAll(/\brunAnalysis\s*\(\s*['"`]([^'"`]+)['"`]/g),
  ].map((match) => match[1])

  return {
    directory,
    files,
    source,
    taskInvocations: [...new Set(taskInvocations)],
    hasContextProviderFile: existsSync(join(directory, 'contextProvider.ts')),
  }
}

const EVIDENCE = Object.fromEntries(
  FIRST_PARTY_PLUGIN_IDS.map((pluginId) => [pluginId, pluginEvidence(pluginId)]),
) as Record<FirstPartyPluginId, ReturnType<typeof pluginEvidence>>

const instructionIds = new Set(listPluginInstructionDefinitions().map((definition) => definition.id))
const definitionIds = new Set(ALL_PLUGIN_DEFINITIONS.map((definition) => definition.id))
const availablePluginIds = new Set(ALL_AVAILABLE_PLUGINS.map((plugin) => plugin.id))
const definitionSource = readFileSync(DEFINITION_FILE, 'utf8')

function expectedTask(pluginId: FirstPartyPluginId): boolean {
  const runtimeClass = EXPECTED_BOUNDARIES[pluginId].runtimeClass
  return runtimeClass === 'ai-task' || runtimeClass === 'hybrid'
}

function expectedContextProvider(pluginId: FirstPartyPluginId): boolean {
  const runtimeClass = EXPECTED_BOUNDARIES[pluginId].runtimeClass
  return runtimeClass === 'context-provider' || runtimeClass === 'hybrid'
}

function relativeToDesktop(file: string): string {
  return relative(join(SRC_ROOT, '..'), file).split(/[\\/]/).join('/')
}

const LEGACY_ENTRY_PATTERNS: ReadonlyArray<[string, RegExp]> = [
  ['onAiPrompt', /\bonAiPrompt\b/],
  ['systemPromptEnhancer', /\bsystemPromptEnhancer\b/],
  ['openSession', /\bopenSession\b/],
  ['suggestContinuation', /\bsuggestContinuation\b/],
  ['component-level system prompt assignment', /\b(?:systemPrompt|promptText)\s*=/],
  ['direct model invocation', /\b(?:generateText|generateObject|streamAi)\s*\(/],
  [
    'direct LLM provider import',
    /(?:from|import)\s*['"](?:@inkpi\/ai|@ai-sdk\/|@anthropic-ai\/|@google\/|@mistralai\/)/,
  ],
]

function collectLegacyViolations(): string[] {
  const files = implementationFiles(SRC_ROOT)
  const violations: string[] = []

  for (const file of files) {
    const source = stripComments(readFileSync(file, 'utf8'))
    for (const [name, pattern] of LEGACY_ENTRY_PATTERNS) {
      if (pattern.test(source)) {
        violations.push(`${relativeToDesktop(file)} -> ${name}`)
      }
      pattern.lastIndex = 0
    }
  }

  const nonAdapterFiles = files.filter((file) => !file.split(/[\\/]/).includes('adapters'))
  for (const file of nonAdapterFiles) {
    const source = stripComments(readFileSync(file, 'utf8'))
    if (/(?:task|instruction)\.(?:submit|status|cancel|steer|resume)/.test(source)) {
      violations.push(`${relativeToDesktop(file)} -> raw task/instruction RPC`)
    }
    if (/\b(?:session|agent)\.[a-z][\w.]*/.test(source)) {
      violations.push(`${relativeToDesktop(file)} -> legacy session/agent RPC`)
    }
    if (
      /setTimeout\s*\(\s*(?:async\s*)?\(\)\s*=>[\s\S]{0,320}\b(?:runAnalysis|runTask|generateText|generateObject|streamAi)\s*\(/.test(
        source,
      )
    ) {
      violations.push(`${relativeToDesktop(file)} -> setTimeout AI mock path`)
    }
    if (
      /(?:innerHTML|dangerouslySetInnerHTML|DOMParser)[^\n]*(?:runAnalysis|runTask|aiAssistant)|(?:runAnalysis|runTask|aiAssistant)[^\n]*(?:innerHTML|dangerouslySetInnerHTML|DOMParser)/.test(
        source,
      )
    ) {
      violations.push(`${relativeToDesktop(file)} -> HTML to AI direct path`)
    }
  }

  return violations.sort()
}

describe('Phase 20 first-party plugin migration matrix', () => {
  it('uses the actual 44 plugin directories, static definitions, and lazy registry as one universe', () => {
    const directoryIds = readdirSync(PLUGIN_ROOT)
      .filter((name) => statSync(join(PLUGIN_ROOT, name)).isDirectory())
      .sort()

    expect(FIRST_PARTY_PLUGIN_IDS).toHaveLength(44)
    expect(new Set(FIRST_PARTY_PLUGIN_IDS).size).toBe(44)
    expect(directoryIds).toEqual([...FIRST_PARTY_PLUGIN_IDS].sort())
    expect(definitionIds).toEqual(new Set(FIRST_PARTY_PLUGIN_IDS))
    expect(availablePluginIds).toEqual(new Set(FIRST_PARTY_PLUGIN_IDS))
    expect(Object.keys(PLUGIN_RUNTIME_CATALOG).sort()).toEqual(directoryIds)
  })

  it.each(FIRST_PARTY_PLUGIN_IDS)('%s has an evidence-backed Phase 20 boundary', (pluginId) => {
    const expected = EXPECTED_BOUNDARIES[pluginId]
    const entry = PLUGIN_RUNTIME_CATALOG[pluginId]
    const definition = ALL_PLUGIN_DEFINITIONS.find((item) => item.id === pluginId)
    const evidence = EVIDENCE[pluginId]
    const indexFile = join(evidence.directory, 'index.ts')
    const indexSource = readFileSync(indexFile, 'utf8')

    expect(entry).toMatchObject({
      pluginId,
      runtimeClass: expected.runtimeClass,
      runtimeTarget: expected.runtimeTarget,
    })
    expect(definition).toBeDefined()
    expect(evidence.files.length).toBeGreaterThan(0)
    expect(existsSync(indexFile)).toBe(true)
    expect(indexSource).toMatch(new RegExp(`\\bid\\s*:\\s*['"]${pluginId}['"]`))
    expect(definitionSource).toContain(`../plugins/${pluginId}`)

    expect(evidence.taskInvocations).toEqual(expectedTask(pluginId) ? [pluginId] : [])
    expect(evidence.hasContextProviderFile).toBe(expectedContextProvider(pluginId))
    expect(Boolean(definition?.contextProvider)).toBe(expectedContextProvider(pluginId))

    if (expectedTask(pluginId)) {
      expect(entry.taskKind).toBe(`plugin.${pluginId}.analysis`)
      expect(instructionIds).toContain(entry.taskKind)
    } else {
      expect(entry.taskKind).toBeUndefined()
      expect(instructionIds).not.toContain(`plugin.${pluginId}.analysis`)
    }

    if (expectedContextProvider(pluginId)) {
      expect(entry.contextProviderId).toBe(`story.context.${pluginId}`)
    } else {
      expect(entry.contextProviderId).toBeUndefined()
    }
  })

  it('keeps source-discovered task and context-provider sets aligned with the catalog', () => {
    const taskIds = FIRST_PARTY_PLUGIN_IDS.filter((pluginId) => EVIDENCE[pluginId].taskInvocations.length > 0)
    const contextProviderIds = FIRST_PARTY_PLUGIN_IDS.filter(
      (pluginId) => EVIDENCE[pluginId].hasContextProviderFile,
    )
    const expectedTaskIds = FIRST_PARTY_PLUGIN_IDS.filter((pluginId) => expectedTask(pluginId))
    const expectedContextProviderIds = FIRST_PARTY_PLUGIN_IDS.filter((pluginId) =>
      expectedContextProvider(pluginId),
    )

    expect(taskIds).toEqual(expectedTaskIds)
    expect(contextProviderIds).toEqual(expectedContextProviderIds)
    expect(
      Object.values(PLUGIN_RUNTIME_CATALOG)
        .filter((entry) => entry.taskKind)
        .map((entry) => entry.pluginId),
    ).toEqual(expectedTaskIds)
  })

  it('keeps tool/workflow classification-only targets and UI-only plugins out of Runtime tasks', () => {
    const classificationOnlyIds = FIRST_PARTY_PLUGIN_IDS.filter(
      (pluginId) => EXPECTED_BOUNDARIES[pluginId].disposition === 'classification-only',
    )
    const actualClassificationOnlyIds = FIRST_PARTY_PLUGIN_IDS.filter(
      (pluginId) =>
        (PLUGIN_RUNTIME_CATALOG[pluginId].runtimeClass === 'tool' ||
          PLUGIN_RUNTIME_CATALOG[pluginId].runtimeClass === 'workflow') &&
        EVIDENCE[pluginId].taskInvocations.length === 0 &&
        !EVIDENCE[pluginId].hasContextProviderFile,
    )
    const uiOnlyIds = FIRST_PARTY_PLUGIN_IDS.filter(
      (pluginId) => EXPECTED_BOUNDARIES[pluginId].runtimeClass === 'ui-only',
    )

    expect(actualClassificationOnlyIds).toEqual(classificationOnlyIds)
    expect(classificationOnlyIds).toEqual([
      'diff-reviewer',
      'memory-palace',
      'multiverse-whatif',
      'press-forge',
      'scrapbook-recycler',
      'storyboard-gen',
    ])
    for (const pluginId of [...classificationOnlyIds, ...uiOnlyIds]) {
      expect(PLUGIN_RUNTIME_CATALOG[pluginId].taskKind).toBeUndefined()
      expect(EVIDENCE[pluginId].taskInvocations).toEqual([])
    }
  })
})

describe('Phase 21 Desktop legacy AI cleanup', () => {
  it('does not retain the removed legacy AI entry points or direct provider paths', () => {
    expect(collectLegacyViolations()).toEqual([])
  })

  it('keeps plugin task construction behind the host task boundary', () => {
    const hostSource = stripComments(readFileSync(HOST_CONTEXT_FILE, 'utf8'))
    expect(hostSource).toContain('createPluginAnalysisTask')
    expect(hostSource).toMatch(/runTask\s*\(/)

    const pluginSources = FIRST_PARTY_PLUGIN_IDS.map((pluginId) => EVIDENCE[pluginId].source).join('\n')
    expect(pluginSources).not.toMatch(/\b(?:generateText|generateObject|streamAi)\s*\(/)
    expect(pluginSources).not.toMatch(
      /(?:from|import)\s*['"](?:@inkpi\/ai|@ai-sdk\/|@anthropic-ai\/|@google\/|@mistralai\/)/,
    )
  })
})
