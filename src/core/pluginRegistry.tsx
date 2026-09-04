import {
  useState,
  useEffect,
  useCallback,
  useContext,
  createContext,
  type FC,
  type ReactNode,
} from 'react'
import type { DesktopPlugin, DesktopPluginCategory } from '../types/plugin'
import { LivingCodexPlugin } from '../plugins/living-codex'
import { PromiseLedgerPlugin } from '../plugins/promise-ledger'
import { TimelineGridPlugin } from '../plugins/timeline-grid'
import { SafeGatePlugin } from '../plugins/safe-gate'
import { SceneBeatsPlugin } from '../plugins/scene-beats'
import { DescribePalettePlugin } from '../plugins/describe-palette'
import { NameForgePlugin } from '../plugins/name-forge'
import { ExpectationEnginePlugin } from '../plugins/expectation-engine'
import { ConsistencySentinelPlugin } from '../plugins/consistency-sentinel'
import { SprintArenaPlugin } from '../plugins/sprint-arena'
import { indexedDbKeyValueStore } from '../adapters/indexedDbKeyValueStore'
import { localStorageKeyValueStore } from '../adapters/localStorageKeyValueStore'

export const STORAGE_KEY_ENABLED_PLUGINS = 'inkpi_enabled_plugins_v1'

// 系统内所有可用插件注册列表
export const ALL_AVAILABLE_PLUGINS: DesktopPlugin[] = [
  LivingCodexPlugin,
  PromiseLedgerPlugin,
  TimelineGridPlugin,
  SafeGatePlugin,
  SceneBeatsPlugin,
  DescribePalettePlugin,
  NameForgePlugin,
  ExpectationEnginePlugin,
  ConsistencySentinelPlugin,
  SprintArenaPlugin,
]

export const PLUGIN_CATEGORIES: { id: DesktopPluginCategory | 'all'; label: string }[] = [
  { id: 'all', label: '全部插件' },
  { id: 'lore', label: '设定与世界书' },
  { id: 'plot', label: '大纲与因果' },
  { id: 'review', label: '质检与门禁' },
  { id: 'craft', label: '修辞与调色' },
  { id: 'rhythm', label: '网文节奏' },
  { id: 'flow', label: '心流与竞技' },
  { id: 'tools', label: '辅助与工具' },
]

export function loadEnabledPluginIds(): Set<string> {
  try {
    const raw = localStorageKeyValueStore.getSync(STORAGE_KEY_ENABLED_PLUGINS)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return new Set(parsed)
    }
  } catch (e) {
    console.warn('Failed to parse enabled plugins from storage:', e)
  }
  const defaults = ALL_AVAILABLE_PLUGINS.filter((p) => p.enabledByDefault !== false).map(
    (p) => p.id,
  )
  return new Set(defaults)
}

export function saveEnabledPluginIds(ids: Set<string>): void {
  const list = Array.from(ids)
  indexedDbKeyValueStore.set(STORAGE_KEY_ENABLED_PLUGINS, JSON.stringify(list)).catch((e) => {
    console.warn('Failed to persist enabled plugins:', e)
  })
}

export async function loadEnabledPluginIdsFromIDB(): Promise<Set<string> | null> {
  try {
    const raw = await indexedDbKeyValueStore.get(STORAGE_KEY_ENABLED_PLUGINS)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return new Set(parsed)
    }
  } catch (e) {
    console.warn('Failed to load enabled plugins from storage:', e)
  }
  return null
}

// ── 共享状态（Context，单一来源、可注入）──
export interface PluginContextValue {
  allPlugins: DesktopPlugin[]
  activePlugins: DesktopPlugin[]
  enabledIds: Set<string>
  isPluginEnabled: (id: string) => boolean
  enablePlugin: (id: string) => void
  disablePlugin: (id: string) => void
  togglePlugin: (id: string) => void
}

const PluginContext = createContext<PluginContextValue | null>(null)

export const PluginProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [enabledIds, setEnabledIds] = useState<Set<string>>(() => loadEnabledPluginIds())

  useEffect(() => {
    let cancelled = false
    loadEnabledPluginIdsFromIDB().then((fromIDB) => {
      if (cancelled || !fromIDB) return
      const hasLocalSaved = localStorageKeyValueStore.hasKeySync(STORAGE_KEY_ENABLED_PLUGINS)
      setEnabledIds((current) => {
        if (hasLocalSaved) {
          const fromLocal = loadEnabledPluginIds()
          return setsEqual(current, fromLocal) ? current : fromLocal
        }
        return setsEqual(current, fromIDB) ? current : fromIDB
      })
    })
    return () => {
      cancelled = true
    }
  }, [])

  const enablePlugin = useCallback((id: string) => {
    setEnabledIds((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      saveEnabledPluginIds(next)
      return next
    })
  }, [])

  const disablePlugin = useCallback((id: string) => {
    setEnabledIds((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      saveEnabledPluginIds(next)
      return next
    })
  }, [])

  const togglePlugin = useCallback((id: string) => {
    setEnabledIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveEnabledPluginIds(next)
      return next
    })
  }, [])

  const isPluginEnabled = useCallback((id: string) => enabledIds.has(id), [enabledIds])

  const value: PluginContextValue = {
    allPlugins: ALL_AVAILABLE_PLUGINS,
    activePlugins: ALL_AVAILABLE_PLUGINS.filter((p) => enabledIds.has(p.id)),
    enabledIds,
    isPluginEnabled,
    enablePlugin,
    disablePlugin,
    togglePlugin,
  }

  return <PluginContext.Provider value={value}>{children}</PluginContext.Provider>
}

export function usePluginRegistry(): PluginContextValue {
  const ctx = useContext(PluginContext)
  if (!ctx) {
    throw new Error('usePluginRegistry 必须在 <PluginProvider> 内使用')
  }
  return ctx
}

export function useOptionalPluginRegistry(): PluginContextValue | null {
  return useContext(PluginContext)
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const x of a) if (!b.has(x)) return false
  return true
}
