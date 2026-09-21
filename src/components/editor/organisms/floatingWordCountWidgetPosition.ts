import { localStorageKeyValueStore } from '../../../adapters/localStorageKeyValueStore'

export const STORAGE_KEY_WIDGET_POS = 'inkpi-writer-assistant-widget-pos'

export function getInitialWidgetPosition(): { x: number; y: number } {
  const fallback = {
    x: Math.max(20, typeof window !== 'undefined' ? window.innerWidth - 380 : 800),
    y: Math.max(40, typeof window !== 'undefined' ? window.innerHeight - 380 : 400),
  }
  try {
    const raw = localStorageKeyValueStore.getSync(STORAGE_KEY_WIDGET_POS)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
        const maxX = Math.max(20, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 100)
        const maxY = Math.max(40, (typeof window !== 'undefined' ? window.innerHeight : 800) - 100)
        return {
          x: Math.min(Math.max(10, parsed.x), maxX),
          y: Math.min(Math.max(10, parsed.y), maxY),
        }
      }
    }
  } catch {
    /* ignore */
  }
  return fallback
}
