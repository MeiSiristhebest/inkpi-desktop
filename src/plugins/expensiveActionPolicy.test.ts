import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { getPluginRuntimeEntry } from '../ai/tasks/pluginRuntimeCatalog'

/**
 * §P2.7 Expensive Action Policy。
 *
 * 一次 AI 调用要花 token、要等模型，所以它只能由作者显式触发（或 debounce + 取消上一次任务）。
 * 「打开面板 / 敲搜索框 → 自动发起模型请求」是禁止形态：press-forge 和 scrapbook-recycler
 * 都曾把 runPluginTool 挂在 useEffect 上，于是切换章节和每敲一个字都是一次真实计费。
 * 本地确定性预览才应该实时跑。
 *
 * 扫描 effect 中的模型调用；Runtime 目录中声明的离线工具不消耗模型 token。
 */

const PLUGIN_ROOT = dirname(fileURLToPath(import.meta.url))
const AI_SEAM = /\b(?:runPluginTask|runPluginTool|runPluginWorkflow|aiTask\.run)\s*\(/g
const EFFECT_CALL = /\buseEffect\s*\(/g

/** effect 调用的括号区间；配不上平限时返回 null，让断言报错而不是静默放过。 */
function balancedParenEnd(source: string, openIndex: number): number | null {
  let depth = 0
  for (let index = openIndex; index < source.length; index += 1) {
    if (source[index] === '(') depth += 1
    else if (source[index] === ')') {
      depth -= 1
      if (depth === 0) return index + 1
    }
  }
  return null
}

function effectTriggeredAiCalls(source: string): string[] {
  const violations: string[] = []
  for (const effect of source.matchAll(EFFECT_CALL)) {
    const open = source.indexOf('(', effect.index ?? 0)
    const end = balancedParenEnd(source, open)
    if (end === null) continue
    const body = source.slice(open, end)
    for (const call of body.matchAll(AI_SEAM)) {
      const pluginId = call[0].startsWith('runPluginTool')
        ? /^\s*(['"])([^'"]+)\1/.exec(body.slice((call.index ?? 0) + call[0].length))?.[2]
        : undefined
      if (pluginId && getPluginRuntimeEntry(pluginId)?.runtimeClass === 'tool') continue
      const line = source.slice(0, effect.index ?? 0).split('\n').length
      violations.push(`useEffect at line ${line} invokes ${call[0].trim()}(…)`)
    }
  }
  return violations
}

function pluginViewSources(directory: string = PLUGIN_ROOT): string[] {
  const files: string[] = []
  for (const name of readdirSync(directory)) {
    const entry = join(directory, name)
    if (statSync(entry).isDirectory()) files.push(...pluginViewSources(entry))
    else if (name.endsWith('.tsx') && !name.includes('.test.')) files.push(entry)
  }
  return files
}

describe('expensive AI action policy (§P2.7)', () => {
  it('flags the forbidden shape and passes the allowed ones (guard self-test)', () => {
    expect(
      effectTriggeredAiCalls(
        `const V = () => { useEffect(() => { void host.runPluginTool('p', { text }) }, [text]); return null }`,
      ),
    ).toHaveLength(1)
    expect(
      effectTriggeredAiCalls(
        `useEffect(() => { void host.runPluginTool('memory-palace', { query }) }, [query])`,
      ),
    ).toHaveLength(0)
    expect(
      effectTriggeredAiCalls(
        `useEffect(() => { void host.runPluginWorkflow('multiverse-whatif', { text }) }, [text])`,
      ),
    ).toHaveLength(1)
    // 本地引擎放在 effect 里是允许的：贵的只有 AI 边界。
    expect(
      effectTriggeredAiCalls(
        `const V = () => { useEffect(() => { setRows(engine.scan(text)) }, [text]); return null }`,
      ),
    ).toHaveLength(0)
    // effect 只让 ref 递增来作废上一次结果，本身不发请求。
    expect(
      effectTriggeredAiCalls(
        `const V = () => { const run = async () => { await runPluginWorkflow('p') }; useEffect(() => { runRef.current += 1 }, [text]); return null }`,
      ),
    ).toHaveLength(0)
  })

  it('keeps every plugin view free of effect-triggered model calls', () => {
    const views = pluginViewSources()
    expect(views.length).toBeGreaterThanOrEqual(40)
    const violations = views.flatMap((file) => {
      const found = effectTriggeredAiCalls(readFileSync(file, 'utf8'))
      return found.map(
        (detail) => `${relative(PLUGIN_ROOT, file).split(/[\\/]/).join('/')}: ${detail}`,
      )
    })
    expect(violations).toEqual([])
  })
})
