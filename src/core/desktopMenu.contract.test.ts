// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EDITOR_SHORTCUTS } from './editorShortcuts'
import { DESKTOP_MENU_EVENT } from './desktopMenu'

/**
 * §P4.7 的跨语言契约：src-tauri/src/menu.rs 里的每个菜单命令 id，必须能在前端的
 * chord 注册表里找到同名条目，否则点击菜单项就是一个静默无反应的按钮（INV-09）。
 * 同时 Rust 侧不得出现任何 chord 字面量或 accelerator 注册——一个快捷键只能有一个主人（§P4.6）。
 */
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const menuSource = readFileSync(join(repoRoot, 'src-tauri', 'src', 'menu.rs'), 'utf8')

function extractCommandIds(source: string): string[] {
  return [
    ...source.matchAll(/(?:FILE_COMMANDS|VIEW_COMMANDS): &\[\(&str, &str\)\] = &\[(.*?)\];/gs),
  ]
    .flatMap((block) =>
      [...(block[1] ?? '').matchAll(/\(\s*"([^"]+)"\s*,\s*"[^"]*"\s*\)/g)].map((m) => m[1] ?? ''),
    )
    .filter(Boolean)
}

/** 返回菜单里有、但前端 chord 注册表里找不到对应条目的 id。 */
function menuIdsWithoutChord(ids: string[]): string[] {
  const known = new Set<string>(EDITOR_SHORTCUTS.map((entry) => entry.id))
  return ids.filter((id) => !known.has(id))
}

function extractMenuEventName(source: string): string {
  return /pub const MENU_EVENT: &str = "([^"]+)"/.exec(source)?.[1] ?? ''
}

describe('原生菜单与前端 chord 注册表的契约', () => {
  const ids = extractCommandIds(menuSource)

  it('确实从 menu.rs 里读到了命令清单，否则下面的断言是在空转', () => {
    expect(ids.length).toBeGreaterThanOrEqual(4)
    expect(ids).toContain('saveChapter')
  })

  it('每个菜单命令都能翻译回一条真实 chord', () => {
    expect(menuIdsWithoutChord(ids), `菜单里有没有对应快捷键的项: ${ids.join(', ')}`).toEqual([])
  })

  it('Rust 侧不注册任何 accelerator，也不写死按键字面量', () => {
    expect(menuSource).not.toMatch(/\.accelerator\(/)
    expect(menuSource).toMatch(/MenuItem::with_id\([^)]*None::<&str>/s)
    expect(menuSource).not.toMatch(/"(CmdOrCtrl|Ctrl|Alt|Shift)\+/)
  })

  it('事件名两端一致', () => {
    expect(extractMenuEventName(menuSource)).toBe(DESKTOP_MENU_EVENT)
  })

  it('反证：清单里塞一个不存在的 id，门控会点名它', () => {
    const synthetic = `const FILE_COMMANDS: &[(&str, &str)] = &[("bogusCommand", "假命令")];`
    const syntheticIds = extractCommandIds(synthetic)
    expect(syntheticIds).toEqual(['bogusCommand'])
    expect(menuIdsWithoutChord(syntheticIds)).toEqual(['bogusCommand'])
    expect(extractMenuEventName(`pub const MENU_EVENT: &str = "other";`)).toBe('other')
  })
})

/**
 * 接线契约：菜单事件必须经过路由器，而不是「派发完就当成功」。
 * 少了 flush 这一步，在数据大屏或插件页签里点击编辑器命令就是一次静默失效的点击。
 */
function wiringGaps(engineSource: string): string[] {
  const gaps: string[] = []
  if (!/createMenuCommandRouter\(/.test(engineSource)) gaps.push('没有创建命令路由器')
  if (!/subscribeDesktopMenu\(\s*\(id\)/.test(engineSource))
    gaps.push('订阅回调没有把命令交给路由器')
  if (!/\.handle\(\s*id\s*\)/.test(engineSource)) gaps.push('菜单事件没有走 handle')
  if (!/\.flush\(\)/.test(engineSource)) gaps.push('缺少切回编辑器后的补发')
  if (!/flush\(\)\s*\}, \[activeTabId\]\)/.test(engineSource)) gaps.push('补发没有挂在页签变化之后')
  if (/^\s*(void )?dispatchDesktopMenuCommand\(/m.test(engineSource))
    gaps.push('绕开路由器直接派发 chord')
  return gaps
}

describe('Engine 里菜单事件的接线', () => {
  const engineSource = readFileSync(join(repoRoot, 'src', 'core', 'engine.tsx'), 'utf8')

  it('订阅、路由、补发三步都在', () => {
    expect(wiringGaps(engineSource), wiringGaps(engineSource).join('；')).toEqual([])
  })

  it('反证：直接派发的写法会被点名', () => {
    const blind = `
      useEffect(() => {
        void subscribeDesktopMenu((id) => {
          dispatchDesktopMenuCommand(id)
        })
      }, [])
    `
    expect(wiringGaps(blind).length).toBeGreaterThan(0)
  })
})
