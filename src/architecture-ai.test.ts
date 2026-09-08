// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ALL_AVAILABLE_PLUGINS } from './core/pluginRegistry'
import { assertFirstPartyPluginCatalog, FIRST_PARTY_PLUGIN_IDS } from './ai/tasks/pluginCatalog'

/**
 * Phase 0 guards for the Desktop AI boundary.
 *
 * Provider selection, Prompt assembly, and model invocation belong behind
 * ports/adapters and the Creative Intelligence Layer. These guards use a
 * ratchet for the legacy Plugin UI calls that are intentionally migrated in
 * later phases.
 */

const SRC_ROOT = dirname(fileURLToPath(import.meta.url))
const DESKTOP_ROOT = join(SRC_ROOT, '..')
const COMPONENT_ROOT = join(SRC_ROOT, 'components')
const PLUGIN_ROOT = join(SRC_ROOT, 'plugins')
const AI_ROOT = join(SRC_ROOT, 'ai')

const SOURCE_FILE = /\.(?:ts|tsx)$/
const TEST_FILE = /(?:\.test|\.spec)\.(?:ts|tsx)$/
const DIRECT_PROMPT_ASSIGNMENT =
  /\b(?:const|let|var)\s+(?:prompt|systemPrompt|promptText|instruction|instructions)\s*=/
const DIRECT_MODEL_CALL =
  /\b(?:aiAssistant\s*(?:\?\.|\.)prompt|streamAi|getProvider|generateText|generateObject)\s*\(/

const RAW_TASK_RPC_METHOD =
  /["'`](?:instruction\.register|task\.(?:submit|status|cancel|steer|resume))["'`]/
const AUTHORITATIVE_IMPORT =
  /from\s+["'][^"']*(?:indexedDb(?:Project|CodexEntity|DomainChange)|(?:project|chapter|volume|codexEntity|domainChange)Repository)[^"']*["']/
const AUTHORITATIVE_WRITE =
  /\b(?:saveChapter|deleteChapter|saveVolume|deleteVolume|mutateActiveChapter|mutateCodexEntity|appendDomainChange|applyDomainChange)\s*\(/

const EXISTING_DIRECT_PROMPT_COMPONENTS = [] as const

const EXISTING_PLUGIN_MODEL_CALL_COMPONENTS = EXISTING_DIRECT_PROMPT_COMPONENTS

type SourceFile = string

function walk(root: string): SourceFile[] {
  const files: SourceFile[] = []
  for (const name of readdirSync(root)) {
    const file = join(root, name)
    if (name === 'node_modules' || name === '.git') continue
    if (statSync(file).isDirectory()) {
      files.push(...walk(file))
    } else if (SOURCE_FILE.test(name) && !TEST_FILE.test(name) && !name.endsWith('.d.ts')) {
      files.push(file)
    }
  }
  return files
}

function componentFiles(): SourceFile[] {
  const applicationComponents = walk(COMPONENT_ROOT)
  const pluginComponents = walk(PLUGIN_ROOT).filter((file) =>
    file.split(/[\\/]/).includes('components'),
  )
  return [...applicationComponents, ...pluginComponents]
}

function executableSourceFiles(): SourceFile[] {
  return walk(SRC_ROOT)
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

function extractImportSpecifiers(source: string): string[] {
  const code = stripComments(source)
  const specifiers: string[] = []
  const patterns = [
    /(?:^|[\s;}])(?:import|export)\s+(?:type\s+)?[\s\S]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /(?:^|[\s;])import\s*['"]([^'"]+)['"]/g,
  ]

  for (const pattern of patterns) {
    for (let match = pattern.exec(code); match !== null; match = pattern.exec(code)) {
      specifiers.push(match[1])
    }
  }
  return specifiers
}

function isLlmProviderSpecifier(specifier: string): boolean {
  const normalized = specifier.toLowerCase()
  return (
    normalized === '@inkpi/ai' ||
    /^(?:ai|anthropic|deepseek|mistral|ollama|openai)(?:\/|$)/.test(normalized) ||
    /^@(?:ai-sdk|anthropic-ai|google|mistralai)(?:\/|$)/.test(normalized)
  )
}

function violationsForImportRule(rule: (specifier: string) => boolean): string[] {
  return componentFiles()
    .flatMap((file) => {
      const relativeFile = relative(DESKTOP_ROOT, file).split(/[\\/]/).join('/')
      const matches = new Set(extractImportSpecifiers(readFileSync(file, 'utf8')).filter(rule))
      return [...matches].map((specifier) => `${relativeFile} -> ${specifier}`)
    })
    .sort()
}

function filesMatching(pattern: RegExp): string[] {
  return componentFiles()
    .filter((file) => pattern.test(stripComments(readFileSync(file, 'utf8'))))
    .map((file) => relative(DESKTOP_ROOT, file).split(/[\\/]/).join('/'))
    .sort()
}

function assertRatchet(rule: string, actual: string[], baseline: readonly string[]): void {
  const actualSet = new Set(actual)
  const baselineSet = new Set(baseline)
  const regressions = actual.filter((file) => !baselineSet.has(file))
  const staleBaseline = baseline.filter((file) => !actualSet.has(file))

  expect(regressions, `${rule} 新增违规:\n${regressions.join('\n')}`).toEqual([])
  expect(
    staleBaseline,
    `${rule} 基线已过期，请删除已迁移文件:\n${staleBaseline.join('\n')}`,
  ).toEqual([])
}

describe('AI Runtime Phase 0 Desktop architecture guards', () => {
  it('keeps the first-party plugin catalog complete and unique', () => {
    expect(new Set(FIRST_PARTY_PLUGIN_IDS).size).toBe(44)
    assertFirstPartyPluginCatalog(ALL_AVAILABLE_PLUGINS.map((plugin) => plugin.id))
  })

  it('Desktop executable source does not import LLM providers directly', () => {
    const violations = executableSourceFiles()
      .flatMap((file) => {
        const relativeFile = relative(DESKTOP_ROOT, file).split(/[\\/]/).join('/')
        const matches = new Set(
          extractImportSpecifiers(stripComments(readFileSync(file, 'utf8'))).filter(
            isLlmProviderSpecifier,
          ),
        )
        return [...matches].map((specifier) => `${relativeFile} -> ${specifier}`)
      })
      .sort()
    expect(violations, `Desktop LLM provider imports:\n${violations.join('\n')}`).toEqual(
      [],
    )
  })

  it('React components do not add direct Prompt construction', () => {
    const violations = filesMatching(DIRECT_PROMPT_ASSIGNMENT)
    assertRatchet(
      'React component Prompt construction',
      violations,
      EXISTING_DIRECT_PROMPT_COMPONENTS,
    )
  })

  it('Plugin UI does not add direct model calls', () => {
    const pluginComponentFiles = componentFiles().filter(
      (file) =>
        file.split(/[\\/]/).includes('plugins') && file.split(/[\\/]/).includes('components'),
    )
    const violations = pluginComponentFiles
      .filter((file) => DIRECT_MODEL_CALL.test(stripComments(readFileSync(file, 'utf8'))))
      .map((file) => relative(DESKTOP_ROOT, file).split(/[\\/]/).join('/'))
      .sort()
    assertRatchet('Plugin UI direct model call', violations, EXISTING_PLUGIN_MODEL_CALL_COMPONENTS)
  })

  it('keeps provider HTTP probes behind adapters', () => {
    const violations = componentFiles()
      .filter((file) => /\bfetch\s*\(/.test(stripComments(readFileSync(file, 'utf8'))))
      .map((file) => relative(DESKTOP_ROOT, file).split(/[\\/]/).join('/'))
      .sort()
    expect(violations, `Direct HTTP from UI components:\n${violations.join('\n')}`).toEqual([])
  })

  it('does not reintroduce removed legacy AI entry points', () => {
    const legacyPatterns = [
      /onAiPrompt/,
      /systemPromptEnhancer/,
      /openSession/,
      /suggestContinuation/,
    ]
    const violations = executableSourceFiles()
      .filter((file) =>
        legacyPatterns.some((pattern) => pattern.test(stripComments(readFileSync(file, 'utf8')))),
      )
      .map((file) => relative(DESKTOP_ROOT, file).split(/[\\/]/).join('/'))
      .sort()
    expect(violations, `Legacy AI entry points:\n${violations.join('\n')}`).toEqual([])
  })

  it('keeps raw task RPC and direct model invocation behind adapters', () => {
    const violations = executableSourceFiles()
      .filter((file) => !file.split(/[\\/]/).includes('adapters'))
      .filter((file) => {
        const source = stripComments(readFileSync(file, 'utf8'))
        return RAW_TASK_RPC_METHOD.test(source) || DIRECT_MODEL_CALL.test(source)
      })
      .map((file) => relative(DESKTOP_ROOT, file).split(/[\\/]/).join('/'))
      .sort()
    expect(violations, `未隔离的 AI RPC/模型调用:\n${violations.join('\n')}`).toEqual([])
  })

  it('keeps session/agent RPC as an explicit compatibility boundary', () => {
    const compatibilityBoundary = new Set(['src/adapters/daemonAiAssistant.ts'])
    const refs = executableSourceFiles().flatMap((file) => {
      const source = stripComments(readFileSync(file, 'utf8'))
      const matches = source.match(/\b(?:session|agent)\.[a-z][\w.-]*/g) || []
      const relativeFile = relative(DESKTOP_ROOT, file).split(/[\\/]/).join('/')
      return matches.map((method) => ({ file: relativeFile, method }))
    })
    const unscoped = refs
      .filter(({ file }) => !compatibilityBoundary.has(file))
      .map(({ file, method }) => `${file} -> ${method}`)
    expect(unscoped, `新 AI 路径不得直接调用旧 session/agent RPC:\n${unscoped.join('\n')}`).toEqual(
      [],
    )
  })

  it('does not allow the AI layer to import or invoke authoritative domain writes', () => {
    const violations = executableSourceFiles()
      .filter((file) => file.startsWith(AI_ROOT))
      .filter((file) => {
        const source = stripComments(readFileSync(file, 'utf8'))
        return AUTHORITATIVE_IMPORT.test(source) || AUTHORITATIVE_WRITE.test(source)
      })
      .map((file) => relative(DESKTOP_ROOT, file).split(/[\\/]/).join('/'))
      .sort()
    expect(violations, `AI layer authoritative write access:\n${violations.join('\n')}`).toEqual([])
  })

  it('the Desktop scanner detects provider, Prompt, and model-call samples', () => {
    const sample = `
      import { streamAi } from '@inkpi/ai';
      const prompt = \`rewrite this\`;
      hostContext?.aiAssistant?.prompt(prompt);
    `
    expect(extractImportSpecifiers(sample)).toContain('@inkpi/ai')
    expect(isLlmProviderSpecifier('@inkpi/ai')).toBe(true)
    expect(DIRECT_PROMPT_ASSIGNMENT.test(sample)).toBe(true)
    expect(DIRECT_MODEL_CALL.test(sample)).toBe(true)
  })
})
