import { useEffect, useRef, type RefObject } from 'react'

/**
 * 浮层内可被 Tab 到达的控件。焦点项计算与 Tab 循环必须读同一份选择器，
 * 否则「初始焦点落在第 1 项」和「Tab 循环的边界」会各自漂移。
 */
export const OVERLAY_FOCUSABLE_SELECTOR =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface OverlayFocusOptions {
  /** 打开中的面板容器；容器不存在时不建立契约。 */
  containerRef: RefObject<HTMLElement | null>
  /** 契约存活窗口。false 时既不抢焦点也不监听按键。 */
  active: boolean
  /** Esc 的目标动作。 */
  onClose: () => void
}

/**
 * 所有模态浮层（Modal / Popover / 命令面板）共用的焦点契约：
 * 记住打开前的焦点 → 把焦点交给面板内首个可聚焦控件（没有则交给面板本身）→
 * Tab 在面板内循环 → Esc 关闭 → 卸载时把焦点还给触发者。
 *
 * 这份逻辑此前在三个文件里各写了一遍，其中命令面板那一份还漏掉了
 * select / textarea / [tabindex] 三类控件。集中一处后，修一次即全局生效。
 */
export function useOverlayFocus({ containerRef, active, onClose }: OverlayFocusOptions): void {
  // 消费方普遍传内联箭头函数，因此 Esc 只能经 ref 读取最新值：
  // 把 onClose 放进下面契约的依赖数组，会让它在宿主每次重渲染时重建，
  // 用户在面板里选中的控件会被抢回首项。
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!active) return
    const el = containerRef.current
    if (!el) return

    const returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusables = () =>
      Array.from(el.querySelectorAll<HTMLElement>(OVERLAY_FOCUSABLE_SELECTOR))

    const first = focusables()[0]
    if (first) {
      first.focus()
    } else {
      el.setAttribute('tabindex', '-1')
      el.focus()
    }

    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const inside = focusables()
      if (inside.length === 0) return
      const currentIndex = inside.indexOf(document.activeElement as HTMLElement)
      const nextIndex = event.shiftKey
        ? currentIndex <= 0
          ? inside.length - 1
          : currentIndex - 1
        : currentIndex === inside.length - 1
          ? 0
          : currentIndex + 1
      event.preventDefault()
      inside[nextIndex]?.focus()
    }

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onCloseRef.current()
    }

    window.addEventListener('keydown', trapFocus)
    window.addEventListener('keydown', handleEsc)
    return () => {
      window.removeEventListener('keydown', trapFocus)
      window.removeEventListener('keydown', handleEsc)
      returnTo?.focus()
    }
    // 契约只在打开/关闭时建立与销毁；onClose 走 ref，见上方注释
  }, [active, containerRef])
}
