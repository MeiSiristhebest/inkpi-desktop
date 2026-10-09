import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * §P2.12 事件总线的契约只能是「产品真的连通」，不能是「名字已经想好了」。
 *
 * 这里曾经是 8 个事件名，其中 3 个生产代码里根本没人 emit，1 个由 multi-calendar 的抽屉
 * 在 useEffect 里用正则碰巧匹配到时间词就广播，payload 写着 chapterId:'current' 和
 * universalAbsoluteDay:100 —— 一次都不成立的章节指针和一个估出来的绝对日。总线测试全绿，
 * 因为它只证明 bus 能传，不证明那两个插件之间有连接。
 */

const CORE_ROOT = dirname(fileURLToPath(import.meta.url))
const SRC_ROOT = join(CORE_ROOT, '..')
const normalizeSource = (source: string) => source.replace(/\r\n?/g, '\n')
const BUS_SOURCE = normalizeSource(readFileSync(join(CORE_ROOT, 'pluginEventBus.ts'), 'utf8'))

function productionSources(directory: string): string[] {
  const files: string[] = []
  for (const name of readdirSync(directory)) {
    const entry = join(directory, name)
    if (statSync(entry).isDirectory()) files.push(...productionSources(entry))
    else if (name.endsWith('.ts') || name.endsWith('.tsx')) {
      if (!name.includes('.test.') && entry !== join(CORE_ROOT, 'pluginEventBus.ts'))
        files.push(entry)
    }
  }
  return files
}

function quotedUnionMembers(block: string): string[] {
  return [...block.matchAll(/'([A-Z][A-Z_]+)'/g)].map((match) => match[1])
}

function declaredEventNames(source = BUS_SOURCE): string[] {
  const union = /export type PluginEventType =([\s\S]*?)\n\n/.exec(normalizeSource(source))?.[1]
  if (!union) throw new Error('找不到 PluginEventType 联合类型，扫描规则需要跟着文件结构更新')
  return quotedUnionMembers(union)
}

function payloadInterfaceKeys(source = BUS_SOURCE): string[] {
  const iface = /export interface PluginEventPayloads \{([\s\S]*?)\n\}/.exec(
    normalizeSource(source),
  )?.[1]
  if (!iface) throw new Error('找不到 PluginEventPayloads，扫描规则需要跟着文件结构更新')
  return [...iface.matchAll(/^ {2}([A-Z][A-Z_]+): \{/gm)].map((match) => match[1])
}

/** name -> 发出这个事件的产物文件（相对 src，便于失败时直接定位）。 */
function publishersByEvent(): Map<string, string[]> {
  const publishers = new Map<string, string[]>()
  for (const file of productionSources(SRC_ROOT)) {
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(/\.emit\(\s*'([A-Z][A-Z_]+)'/g)) {
      const list = publishers.get(match[1]) ?? []
      list.push(file.slice(SRC_ROOT.length + 1).replace(/\\/g, '/'))
      publishers.set(match[1], list)
    }
  }
  return publishers
}

/** name -> 在产物代码里真的订阅了这个事件的文件。连接只能由订阅证明，不能由注释证明。 */
function subscribersByEvent(): Map<string, string[]> {
  const subscribers = new Map<string, string[]>()
  for (const file of productionSources(SRC_ROOT)) {
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(/\.on\(\s*'([A-Z][A-Z_]+)'/g)) {
      const list = subscribers.get(match[1]) ?? []
      list.push(file.slice(SRC_ROOT.length + 1).replace(/\\/g, '/'))
      subscribers.set(match[1], list)
    }
  }
  return subscribers
}

/** 联合类型里用箭头声明了「谁 -> 谁」的那些事件名（连接真假由下面的门控判定）。 */
function eventsClaimingARoute(source = BUS_SOURCE): string[] {
  const union = /export type PluginEventType =([\s\S]*?)\n\n/.exec(normalizeSource(source))?.[1]
  if (!union) throw new Error('找不到 PluginEventType 联合类型，扫描规则需要跟着文件结构更新')
  return union
    .split('\n')
    .flatMap((line) => {
      const match = /\|\s*'([A-Z][A-Z_]+)'(.*)$/.exec(line)
      return match && match[2].includes('->') ? [match[1]] : []
    })
    .sort()
}

describe('plugin event bus contract (§P2.12)', () => {
  it('scans declarations from Windows CRLF checkouts', () => {
    const windowsSource = BUS_SOURCE.replace(/\n/g, '\r\n')

    expect(declaredEventNames(windowsSource)).toEqual(declaredEventNames())
    expect(payloadInterfaceKeys(windowsSource)).toEqual(payloadInterfaceKeys())
    expect(eventsClaimingARoute(windowsSource)).toEqual(eventsClaimingARoute())
  })

  it('names and payload shapes are the same set in both directions', () => {
    expect(payloadInterfaceKeys().sort()).toEqual(declaredEventNames().sort())
  })

  it('every declared event has a production publisher', () => {
    const publishers = publishersByEvent()
    const phantoms = declaredEventNames().filter((name) => !publishers.has(name))
    expect(phantoms).toEqual([])
  })

  it('the scan can actually see the emitters it claims to see (guard self-test)', () => {
    const publishers = publishersByEvent()
    expect(publishers.get('UNIFIED_CHAPTER_EVALUATED')).toEqual([
      'domain/evaluator/ChapterQualityEvaluator.ts',
    ])
    expect(publishers.get('CHAPTER_CONTENT_AUDITED')).toEqual([
      'plugins/reader-hook/engine/ReaderHookEngine.ts',
      'plugins/water-meter/engine/WaterMeterEngine.ts',
    ])
    // §P2.12 的正身：组件里重新写一个 emit 就要让这条门失败。
    expect(publishers.get('CODEX_ENTITY_TOUCHED')).toEqual([
      'services/domainApplicationServices.ts',
    ])
  })

  it('注释里画出的每条联动箭头，都要有产物代码真的订阅它', () => {
    const subscribers = subscribersByEvent()
    const claimed = eventsClaimingARoute()
    // 以前这里写着 living-codex -> aftermath-sync，而 aftermath-sync 一处都没订阅过。
    expect(claimed.filter((name) => !subscribers.has(name))).toEqual([])
    // 扫描不能是空转：4 条箭头是真的声明在联合类型上，第 5 个事件只有发布者、没冒充连接。
    expect(claimed).toEqual([
      'CHAPTER_CONTENT_AUDITED',
      'CODEX_ENTITY_TOUCHED',
      'FORESHADOW_PLANTED',
      'POWER_BREACH_DETECTED',
    ])
    expect(subscribers.has('UNIFIED_CHAPTER_EVALUATED')).toBe(false)
  })
})
