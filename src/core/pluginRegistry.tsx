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
import { ALL_LAZY_PLUGINS } from './pluginDefinitions'
import { indexedDbSettingsKVRepository } from '../adapters/indexedDbSettingsKVRepository'
import { localStorageKeyValueStore } from '../adapters/localStorageKeyValueStore'

export const STORAGE_KEY_ENABLED_PLUGINS = 'inkpi_enabled_plugins_v2'

export function getPluginStorageKey(workspaceId?: string): string {
  return workspaceId ? `inkpi_enabled_plugins_${workspaceId}` : STORAGE_KEY_ENABLED_PLUGINS
}

// 系统内所有可用插件按需懒加载注册列表（体积大幅缩减，首屏零冗余）
export const ALL_AVAILABLE_PLUGINS: DesktopPlugin[] = ALL_LAZY_PLUGINS

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

export const CANONICAL_PLUGIN_KEY = 'enabledPlugins'
const GLOBAL_SETTINGS_SCOPE = '__global__'

function canonicalScope(workspaceId?: string): string {
  return workspaceId || GLOBAL_SETTINGS_SCOPE
}

function parsePluginIds(raw: unknown): Set<string> | null {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(parsed) && parsed.every((id) => typeof id === 'string')
      ? new Set(parsed)
      : null
  } catch {
    return null
  }
}

function legacyPluginIds(workspaceId?: string): Set<string> | null {
  const keys = workspaceId
    ? [getPluginStorageKey(workspaceId), STORAGE_KEY_ENABLED_PLUGINS]
    : [STORAGE_KEY_ENABLED_PLUGINS]
  for (const key of keys) {
    const ids = parsePluginIds(localStorageKeyValueStore.getSync(key))
    if (ids) return ids
  }
  return null
}

function defaultPluginIds(): Set<string> {
  return new Set(
    ALL_AVAILABLE_PLUGINS.filter((plugin) => plugin.enabledByDefault !== false).map(
      (plugin) => plugin.id,
    ),
  )
}

/** Synchronous read used only for first paint and legacy migration. */
export function loadEnabledPluginIds(workspaceId?: string): Set<string> {
  return legacyPluginIds(workspaceId) ?? defaultPluginIds()
}

export function saveEnabledPluginIds(ids: Set<string>, workspaceId?: string): void {
  const next = Array.from(ids)
  void indexedDbSettingsKVRepository
    .set(canonicalScope(workspaceId), CANONICAL_PLUGIN_KEY, next)
    .then(async () => {
      const legacyKey = getPluginStorageKey(workspaceId)
      await localStorageKeyValueStore.remove?.(legacyKey)
      if (workspaceId) await localStorageKeyValueStore.remove?.(STORAGE_KEY_ENABLED_PLUGINS)
    })
    .catch((error) => {
      console.warn('Failed to persist enabled plugins:', error)
    })
}

export async function loadEnabledPluginIdsFromIDB(
  workspaceId?: string,
): Promise<Set<string> | null> {
  try {
    const canonical = await indexedDbSettingsKVRepository.get<unknown>(
      canonicalScope(workspaceId),
      CANONICAL_PLUGIN_KEY,
      null,
    )
    const canonicalIds = parsePluginIds(canonical)
    if (canonicalIds) return canonicalIds

    const legacy = legacyPluginIds(workspaceId)
    if (!legacy) return null

    await indexedDbSettingsKVRepository.set(
      canonicalScope(workspaceId),
      CANONICAL_PLUGIN_KEY,
      Array.from(legacy),
    )
    await localStorageKeyValueStore.remove?.(getPluginStorageKey(workspaceId))
    if (workspaceId) await localStorageKeyValueStore.remove?.(STORAGE_KEY_ENABLED_PLUGINS)
    return legacy
  } catch (error) {
    console.warn('Failed to load enabled plugins from IndexedDB:', error)
    return null
  }
}

// ── 共享状态（Context，单一来源、可注入）──
export interface PluginContextValue {
  allPlugins: DesktopPlugin[]
  activePlugins: DesktopPlugin[]
  enabledIds: Set<string>
  workspaceId?: string
  isPluginEnabled: (id: string) => boolean
  enablePlugin: (id: string) => void
  disablePlugin: (id: string) => void
  togglePlugin: (id: string) => void
}

const PluginContext = createContext<PluginContextValue | null>(null)

export const PluginProvider: FC<{ workspaceId?: string; children: ReactNode }> = ({
  workspaceId,
  children,
}) => {
  const [enabledIds, setEnabledIds] = useState<Set<string>>(() => loadEnabledPluginIds(workspaceId))

  useEffect(() => {
    setEnabledIds(loadEnabledPluginIds(workspaceId))
    let cancelled = false
    loadEnabledPluginIdsFromIDB(workspaceId).then((fromIDB) => {
      if (cancelled || !fromIDB) return
      setEnabledIds((current) => (setsEqual(current, fromIDB) ? current : fromIDB))
    })
    return () => {
      cancelled = true
    }
  }, [workspaceId])

  const enablePlugin = useCallback(
    (id: string) => {
      setEnabledIds((prev) => {
        if (prev.has(id)) return prev
        const next = new Set(prev)
        next.add(id)
        saveEnabledPluginIds(next, workspaceId)
        return next
      })
    },
    [workspaceId],
  )

  const disablePlugin = useCallback(
    (id: string) => {
      setEnabledIds((prev) => {
        if (!prev.has(id)) return prev
        const next = new Set(prev)
        next.delete(id)
        saveEnabledPluginIds(next, workspaceId)
        return next
      })
    },
    [workspaceId],
  )

  const togglePlugin = useCallback(
    (id: string) => {
      setEnabledIds((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        saveEnabledPluginIds(next, workspaceId)
        return next
      })
    },
    [workspaceId],
  )

  const isPluginEnabled = useCallback((id: string) => enabledIds.has(id), [enabledIds])

  const value: PluginContextValue = {
    allPlugins: ALL_AVAILABLE_PLUGINS,
    activePlugins: ALL_AVAILABLE_PLUGINS.filter((p) => enabledIds.has(p.id)),
    enabledIds,
    workspaceId,
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
