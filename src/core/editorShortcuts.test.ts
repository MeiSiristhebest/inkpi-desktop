// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EDITOR_SHORTCUTS, formatShortcutLabel, shortcutHint } from './editorShortcuts'
import { commandRegistry } from './commandRegistry'
import { registerDefaultCommands } from './defaultCommands'

const here = dirname(fileURLToPath(import.meta.url))
const srcRoot = join(here, '..')

// 本产品只发布 Windows，Mod 一律解析为 Ctrl，因此 `Mod+B` 与 `Ctrl+B` 抢的是同一个键位，
// 归一化时必须折叠，否则冲突检测器会漏掉计划点名的那一类重叠。
const normalize = (shortcut: string): string =>
  [
    ...new Set(
      shortcut
        .split('+')
        .slice(0, -1)
        .map((part) => {
          const p = part.trim().toLowerCase()
          return p === 'mod' ? 'ctrl' : p
        }),
    ),
    shortcut.split('+').pop()!.trim().toLowerCase(),
  ]
    .sort()
    .join('+')

/** 返回所有重复占用同一键位的 id 对（含修饰键顺序不同、大小写不同的等价写法）。 */
function findConflicts(entries: { id?: string; title?: string; shortcut: string }[]): string[] {
  const byChord = new Map<string, string[]>()
  for (const entry of entries) {
    const name = entry.id ?? entry.title ?? entry.shortcut
    const chord = normalize(entry.shortcut)
    byChord.set(chord, [...(byChord.get(chord) ?? []), name])
  }
  return [...byChord.entries()]
    .filter(([, names]) => names.length > 1)
    .map(([chord, names]) => `${chord}: ${names.join(' / ')}`)
}

describe('editor shortcut registry', () => {
  it('binds each chord to exactly one action', () => {
    expect(findConflicts(EDITOR_SHORTCUTS as unknown as { shortcut: string }[])).toEqual([])
  })

  it('does not steal a chord from a command-registry command', () => {
    // registerDefaultCommands 才是登记入口（engine.tsx 挂载时调用），裸 import 不会注册任何命令。
    const unregister = registerDefaultCommands()
    try {
      const commandShortcuts = commandRegistry
        .getAll()
        .filter((command) => command.shortcut)
        .map((command) => ({ title: command.title, shortcut: command.shortcut! }))
      // 计划点名的现场就是这类冲突：编辑器把 Mod+B 当加粗，全局层却拿它去收章节树。
      // 先确认命令侧真的带快捷键，否则这条门控只是在拿空数组自证。
      expect(commandShortcuts.length).toBeGreaterThan(0)
      expect(findConflicts([...commandShortcuts, ...EDITOR_SHORTCUTS])).toEqual([])
    } finally {
      unregister()
    }
  })

  it('detects a conflict when one is introduced', () => {
    // 反证：若检测器永远返回 []，上面两条门控就是在空转。
    const conflicts = findConflicts([
      { id: 'bold', shortcut: 'Mod+B' },
      { id: 'collapseTree', shortcut: 'Ctrl+B' },
    ])
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]).toContain('bold / collapseTree')
  })

  it('renders every chord for the only platform this product ships', () => {
    for (const { id, shortcut } of EDITOR_SHORTCUTS) {
      const label = formatShortcutLabel(shortcut)
      expect(label, `${id} 的展示文案泄漏了跨平台记法`).not.toMatch(/\bMod\b/)
      expect(label).not.toContain('⌘')
      expect(label).not.toContain('⇧')
      if (shortcut.startsWith('Mod+') || shortcut.includes('+Mod+')) {
        expect(label).toContain('Ctrl')
      }
    }
  })

  it('formats modifiers in reading order and maps the arrow keys', () => {
    expect(formatShortcutLabel('Mod+S')).toBe('Ctrl + S')
    expect(formatShortcutLabel('Shift+Mod+Z')).toBe('Shift + Ctrl + Z')
    expect(formatShortcutLabel('Alt+ArrowUp')).toBe('Alt + ↑')
    expect(formatShortcutLabel('Mod+\\')).toBe('Ctrl + \\')
    expect(formatShortcutLabel('F2')).toBe('F2')
    expect(shortcutHint('加粗', 'bold')).toBe('加粗 (Ctrl + B)')
  })
})

describe('rendered shortcut strings stay derived from the registry', () => {
  it('ships no hand-written mac glyph in any product string', () => {
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name)
        if (statSync(full).isDirectory()) {
          walk(full)
          continue
        }
        if (!/\.(ts|tsx)$/.test(name) || name.includes('.test.')) continue
        readFileSync(full, 'utf8')
          .split('\n')
          .forEach((line, index) => {
            const text = line.trim()
            // 注释行不参与朗读，也不算用户可见文案
            if (text.startsWith('//') || text.startsWith('/*') || text.startsWith('*')) return
            if (!/[⌘⇧⌃⌥]/.test(text)) return
            offenders.push(`${relative(srcRoot, full)}:${index + 1} ${text.slice(0, 60)}`)
          })
      }
    }
    walk(srcRoot)
    expect(offenders).toEqual([])
  })
})
