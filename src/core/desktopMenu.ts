import { EDITOR_SHORTCUTS, getEditorShortcut, type EditorShortcutId } from './editorShortcuts'

/**
 * 原生菜单 → 前端命令（§P4.7）。
 *
 * Windows 原生菜单在 Rust 侧（src-tauri/src/menu.rs）只带命令 id，不带快捷键：
 * chord 的唯一主人是 EDITOR_SHORTCUTS（§P4.6）。这里把 id 翻译回那条 chord，并以一次
 * 与键盘完全相同的 window keydown 派发出去，于是鼠标路径和键盘路径命中的是同一个
 * handler。若在原生侧再注册一份 Ctrl+S，一次按键就会被执行两遍。
 *
 * 已知边界：订阅者挂在 Engine 上，所以作品库界面（Engine 未挂载）里这些自定义菜单项不会有
 * 反应——今天的 Ctrl+K 在同一个界面上也一样。要兑现它们，需要把菜单可用状态跟当前表面同步，
 * 那是另一件事。
 */

/** 与 src-tauri/src/menu.rs 的 MENU_EVENT 保持一致。 */
export const DESKTOP_MENU_EVENT = 'desktop-menu'

/** chord 字符串 → KeyboardEvent 初始化字段；解析规则与 commandRegistry.matchesShortcut 同构。 */
export function keyboardInitForChord(shortcut: string): KeyboardEventInit {
  const parts = shortcut
    .split('+')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
  const modifiers = new Set(parts.slice(0, -1))
  return {
    key: parts.at(-1) ?? '',
    ctrlKey: modifiers.has('mod') || modifiers.has('ctrl'),
    metaKey: modifiers.has('meta') || modifiers.has('cmd'),
    shiftKey: modifiers.has('shift'),
    altKey: modifiers.has('alt') || modifiers.has('option'),
    bubbles: true,
    cancelable: true,
  }
}

/**
 * 派发一次与键盘等价的 keydown。
 * 返回值表示「有没有处理方接住这条命令」：处理方命中后一定会 preventDefault，
 * 所以 defaultPrevented 就是消费凭证。未知 id 不派发，直接 false。
 */
export function dispatchDesktopMenuCommand(id: string): boolean {
  if (!EDITOR_SHORTCUTS.some((candidate) => candidate.id === id)) return false
  if (typeof window === 'undefined') return false
  const { shortcut } = getEditorShortcut(id as EditorShortcutId)
  const event = new KeyboardEvent('keydown', keyboardInitForChord(shortcut))
  window.dispatchEvent(event)
  return event.defaultPrevented
}

export interface MenuCommandRouterTarget {
  /** 当前是否停在正文编辑器：编辑器命令的处理方只挂在那里。 */
  isEditorActive: () => boolean
  /** 切回正文编辑器。 */
  openEditor: () => void
}

/**
 * 菜单命令路由器。
 *
 * 原生菜单永远可见，但除命令面板外，那些 chord 的处理方是 RichEditor 的 window
 * keydown 监听器——用户切到数据大屏或插件页签后它们就随编辑器一起卸载了。
 * 直接派发会让一个看得见的菜单项静默失效，所以这里在「没人接住」时先请求切回编辑器，
 * 等编辑器挂载完成再由 flush() 补发同一条 chord。
 */
export function createMenuCommandRouter(target: MenuCommandRouterTarget) {
  let deferred: string | null = null

  return {
    /** 'handled' 已执行；'deferred' 已切回编辑器待补发；'ignored' 无法兑现。 */
    handle(id: string): 'handled' | 'deferred' | 'ignored' {
      if (dispatchDesktopMenuCommand(id)) {
        deferred = null
        return 'handled'
      }
      // 已经在编辑器里还没人接住，就不要留队列：一条陈旧命令在用户下次切页签时
      // 突然执行，比这次点击没反应更糟。
      if (target.isEditorActive()) {
        deferred = null
        return 'ignored'
      }
      deferred = id
      target.openEditor()
      return 'deferred'
    },

    /** 补发被推迟的命令；没有待处理命令时返回 false。 */
    flush(): boolean {
      const id = deferred
      if (!id) return false
      deferred = null
      if (!target.isEditorActive()) return false
      return dispatchDesktopMenuCommand(id)
    },
  }
}

/** 订阅原生菜单事件。在浏览器 / 测试环境里是 no-op。 */
export async function subscribeDesktopMenu(onCommand: (id: string) => void): Promise<() => void> {
  if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) return () => {}
  const { listen } = await import('@tauri-apps/api/event')
  return listen<string>(DESKTOP_MENU_EVENT, ({ payload }) => {
    onCommand(payload)
  })
}
