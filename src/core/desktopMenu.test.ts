import { describe, it, expect, vi, afterEach } from 'vitest'
import { matchesEditorShortcut, EDITOR_SHORTCUTS } from './editorShortcuts'
import {
  DESKTOP_MENU_EVENT,
  createMenuCommandRouter,
  dispatchDesktopMenuCommand,
  keyboardInitForChord,
  subscribeDesktopMenu,
} from './desktopMenu'

/**
 * §P4.7 的原生菜单不做任何按键绑定：Rust 只发命令 id，前端翻译回注册表里那条 chord 再派发。
 * 这组用例盯的就是「菜单点击 == 按下那条 chord」这个等式本身，以及处理方在场/不在场时的分流。
 */
describe('desktop menu command bridge', () => {
  const listeners: (() => void)[] = []
  afterEach(() => {
    listeners.splice(0).forEach((off) => off())
  })

  /** 装一个与 RichEditor 同构的处理方：命中 chord 就 preventDefault 认领。 */
  function installHandler(id: string) {
    const handler = vi.fn()
    const onKey = (e: KeyboardEvent) => {
      if (!matchesEditorShortcut(id, e)) return
      e.preventDefault()
      handler()
    }
    window.addEventListener('keydown', onKey)
    listeners.push(() => window.removeEventListener('keydown', onKey))
    return handler
  }

  it('把 chord 解析成与 matchesShortcut 同构的按键字段', () => {
    expect(keyboardInitForChord('Mod+S')).toMatchObject({ key: 's', ctrlKey: true })
    expect(keyboardInitForChord('Shift+Mod+Z')).toMatchObject({
      key: 'z',
      ctrlKey: true,
      shiftKey: true,
    })
    expect(keyboardInitForChord('Alt+ArrowUp')).toMatchObject({ key: 'arrowup', altKey: true })
    expect(keyboardInitForChord('F2')).toMatchObject({ key: 'f2', ctrlKey: false, altKey: false })
  })

  it('每个编辑器 chord 都能被还原成一次真实匹配的 keydown', () => {
    for (const { id, shortcut } of EDITOR_SHORTCUTS) {
      const handler = installHandler(id)

      expect(dispatchDesktopMenuCommand(id), `${id}（${shortcut}）应被认领`).toBe(true)
      expect(handler, `${id}（${shortcut}）没有收到匹配的按键事件`).toHaveBeenCalledTimes(1)

      listeners.pop()?.()
    }
  })

  it('没有处理方认领时返回 false，而不是谎报成功', () => {
    // 菜单永远可见，但编辑器命令的处理方随 RichEditor 卸载；
    // 这里必须让调用方看出「按键发出去了，但没人接」。
    const spy = vi.fn()
    const onKey = () => spy()
    window.addEventListener('keydown', onKey)
    listeners.push(() => window.removeEventListener('keydown', onKey))

    expect(dispatchDesktopMenuCommand('saveChapter')).toBe(false)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('未知 id 不派发也不抛，直接返回 false', () => {
    const spy = installHandler('saveChapter')

    expect(dispatchDesktopMenuCommand('closeEverything')).toBe(false)
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('desktop menu command router', () => {
  const listeners: (() => void)[] = []
  afterEach(() => {
    listeners.splice(0).forEach((off) => off())
  })

  function addKeydown(onKey: (e: KeyboardEvent) => void) {
    window.addEventListener('keydown', onKey)
    listeners.push(() => window.removeEventListener('keydown', onKey))
  }

  function claimingHandler(id: string, onFire: () => void) {
    addKeydown((e) => {
      if (!matchesEditorShortcut(id, e)) return
      e.preventDefault()
      onFire()
    })
  }

  /**
   * 模拟真实世界：编辑器命令的处理方只在正文编辑器挂载时存在，
   * 所以 state.editorActive 同时决定「页签在不在编辑器」和「监听器在不在场」。
   */
  function makeWorld(id: string, startOnEditor: boolean) {
    const state = { editorActive: startOnEditor }
    const handler = vi.fn()
    addKeydown((e) => {
      if (!state.editorActive || !matchesEditorShortcut(id, e)) return
      e.preventDefault()
      handler()
    })

    const openEditor = vi.fn(() => {
      state.editorActive = true
    })
    return {
      state,
      handler,
      openEditor,
      router: createMenuCommandRouter({
        isEditorActive: () => state.editorActive,
        openEditor,
      }),
    }
  }

  it('处理方在场时直接执行，不动页签', () => {
    const { handler, openEditor, router } = makeWorld('saveChapter', true)

    expect(router.handle('saveChapter')).toBe('handled')
    expect(handler).toHaveBeenCalledTimes(1)
    expect(openEditor).not.toHaveBeenCalled()
  })

  it('处理方不在场时先切回编辑器，挂载完成后补发同一条 chord', () => {
    const { handler, openEditor, router } = makeWorld('newChapter', false)

    expect(router.handle('newChapter')).toBe('deferred')
    expect(handler).not.toHaveBeenCalled()
    expect(openEditor).toHaveBeenCalledTimes(1)

    expect(router.flush()).toBe(true)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('补发只发生一次，不会留下会在别处突然执行的陈旧命令', () => {
    const { handler, router } = makeWorld('newChapter', false)

    router.handle('newChapter')
    expect(router.flush()).toBe(true)
    expect(router.flush()).toBe(false)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('已经在编辑器里却没人认领时不排队', () => {
    // 留在队列里的话，用户下次切走再切回来时会被一条陈旧命令砸中。
    // 这里在场的是 newChapter 的处理方，而菜单发的是 saveChapter。
    const { handler, openEditor, router } = makeWorld('newChapter', true)

    expect(router.handle('saveChapter')).toBe('ignored')
    expect(handler).not.toHaveBeenCalled()
    expect(openEditor).not.toHaveBeenCalled()
    expect(router.flush()).toBe(false)
  })

  it('切页签失败时不把命令留在队列里', () => {
    const { handler } = makeWorld('newChapter', false)
    const router = createMenuCommandRouter({
      isEditorActive: () => false,
      openEditor: () => {},
    })

    expect(router.handle('newChapter')).toBe('deferred')
    expect(router.flush()).toBe(false)
    expect(handler).not.toHaveBeenCalled()
    expect(router.flush()).toBe(false)
  })

  it('命令面板这类全局命令永远不会被推迟', () => {
    // Engine 自己的 window 监听器兜住它，编辑器在不在场都接得住。
    const world = makeWorld('newChapter', false)
    const globalHandler = vi.fn()
    claimingHandler('commandPalette', globalHandler)

    expect(world.router.handle('commandPalette')).toBe('handled')
    expect(globalHandler).toHaveBeenCalledTimes(1)
    expect(world.openEditor).not.toHaveBeenCalled()
    expect(world.router.flush()).toBe(false)
  })
})

describe('subscribeDesktopMenu', () => {
  it('在没有 Tauri 的运行环境里是 no-op', async () => {
    expect('__TAURI_INTERNALS__' in window).toBe(false)
    const onCommand = vi.fn()
    const unlisten = await subscribeDesktopMenu(onCommand)
    expect(() => unlisten()).not.toThrow()
    expect(onCommand).not.toHaveBeenCalled()
  })

  it('事件名与 Rust 侧常量拼写一致（跨语言契约的另一半在 contract 测试里）', () => {
    expect(DESKTOP_MENU_EVENT).toBe('desktop-menu')
  })
})
