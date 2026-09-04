import { useState, useRef, useCallback, useEffect } from 'react'
import { localStorageKeyValueStore } from '../adapters/localStorageKeyValueStore'

export interface UseResizableWidthOptions {
  /** 初始默认宽度（px） */
  initialWidth: number
  /** 最小限制宽度（px）——保证组件内关键元素绝不坍塌 */
  minWidth: number
  /** 最大限制宽度（px）——防止过度拖拽侵占主写作区 */
  maxWidth: number
  /** 本地记忆持久化键名（可选，刷新或下次进入时自动对齐） */
  storageKey?: string
  /** 锚定方向：left（左侧面板，向右拖加宽）；right（右侧面板，向左拖加宽） */
  direction?: 'left' | 'right'
}

export function useResizableWidth({
  initialWidth,
  minWidth,
  maxWidth,
  storageKey,
  direction = 'left',
}: UseResizableWidthOptions) {
  const [width, setWidth] = useState<number>(() => {
    if (storageKey) {
      const saved = localStorageKeyValueStore.getSync(storageKey)
      if (saved) {
        const parsed = Number.parseInt(saved, 10)
        if (!Number.isNaN(parsed) && parsed >= minWidth && parsed <= maxWidth) {
          return parsed
        }
      }
    }
    return initialWidth
  })

  const [isDragging, setIsDragging] = useState<boolean>(false)
  const draggingRef = useRef<boolean>(false)
  const startXRef = useRef<number>(0)
  const startWidthRef = useRef<number>(width)
  const widthRef = useRef<number>(width)
  useEffect(() => {
    widthRef.current = width
  }, [width])

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      draggingRef.current = true
      setIsDragging(true)
      startXRef.current = e.clientX
      startWidthRef.current = widthRef.current

      const handleMouseMove = (ev: MouseEvent) => {
        if (!draggingRef.current) return
        const delta =
          direction === 'left' ? ev.clientX - startXRef.current : startXRef.current - ev.clientX
        const raw = startWidthRef.current + delta
        const next = Math.min(maxWidth, Math.max(minWidth, raw))
        setWidth(next)
      }

      const handleMouseUp = () => {
        draggingRef.current = false
        setIsDragging(false)
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        if (storageKey) {
          void localStorageKeyValueStore.set(storageKey, String(widthRef.current))
        }
      }

      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [direction, minWidth, maxWidth, storageKey],
  )

  const resetWidth = useCallback(() => {
    setWidth(initialWidth)
    if (storageKey) {
      void localStorageKeyValueStore.set(storageKey, String(initialWidth))
    }
  }, [initialWidth, storageKey])

  return {
    width,
    isDragging,
    onMouseDown,
    resetWidth,
  }
}
