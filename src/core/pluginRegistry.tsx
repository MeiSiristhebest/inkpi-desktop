import {
  useState,
  useEffect,
  useCallback,
  useContext,
  createContext,
  useRef,
  type FC,
  type ReactNode,
} from 'react'
import type { DesktopPlugin, DesktopPluginCategory } from '../types/plugin'
import { ALL_LAZY_PLUGINS } from './pluginDefinitions'
import { indexedDbSettingsKVRepository } from '../adapters/indexedDbSettingsKVRepository'
import { localStorageKeyValueStore } from '../adapters/localStorageKeyValueStore'
import { projectEnabledPluginIds } from './defaultCommands'

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

/** Synchronous defaults for first paint. Persisted state is read from IndexedDB. */
export function loadEnabledPluginIds(workspaceId?: string): Set<string> {
  void workspaceId
  return defaultPluginIds()
}

export function saveEnabledPluginIds(ids: Set<string>, workspaceId?: string): Promise<void> {
  const next = Array.from(ids)
  // 返回给调用方等待：新建项目要把工具组合写进这个项目自己的域，写没落地不能说「已创建」。
  return indexedDbSettingsKVRepository
    .set(canonicalScope(workspaceId), CANONICAL_PLUGIN_KEY, next)
    .then(() => removeLegacyPluginIds(workspaceId))
}

export async function loadEnabledPluginIdsFromIDB(
  workspaceId?: string,
): Promise<Set<string> | null> {
  const canonical = await indexedDbSettingsKVRepository.get<unknown>(
    canonicalScope(workspaceId),
    CANONICAL_PLUGIN_KEY,
    null,
  )
  const canonicalIds = parsePluginIds(canonical)
  if (canonicalIds) {
    await removeLegacyPluginIds(workspaceId)
    return canonicalIds
  }

  const legacy = legacyPluginIds(workspaceId)
  if (!legacy) return null

  await indexedDbSettingsKVRepository.set(
    canonicalScope(workspaceId),
    CANONICAL_PLUGIN_KEY,
    Array.from(legacy),
  )
  await removeLegacyPluginIds(workspaceId)
  return legacy
}

async function removeLegacyPluginIds(workspaceId?: string): Promise<void> {
  try {
    await localStorageKeyValueStore.remove?.(getPluginStorageKey(workspaceId))
    if (workspaceId) await localStorageKeyValueStore.remove?.(STORAGE_KEY_ENABLED_PLUGINS)
  } catch {
    // Canonical IndexedDB state remains authoritative when legacy cleanup fails.
  }
}

// ── 共享状态（Context，单一来源、可注入）──
export interface PluginContextValue {
  allPlugins: DesktopPlugin[]
  activePlugins: DesktopPlugin[]
  enabledIds: Set<string>
  workspaceId?: string
  isLoading: boolean
  isSaving: boolean
  persistenceError: string | null
  loadFailed: boolean
  dismissPersistenceError: () => void
  retryLoad: () => void
  retrySave: () => Promise<void>
  isPluginEnabled: (id: string) => boolean
  enablePlugin: (id: string) => Promise<void>
  disablePlugin: (id: string) => Promise<void>
  togglePlugin: (id: string) => Promise<void>
}

const PluginContext = createContext<PluginContextValue | null>(null)

export const PluginProvider: FC<{ workspaceId?: string; children: ReactNode }> = ({
  workspaceId,
  children,
}) => {
  const [enabledIds, setEnabledIds] = useState<Set<string>>(() => defaultPluginIds())
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [persistenceError, setPersistenceError] = useState<string | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [reloadVersion, setReloadVersion] = useState(0)
  const enabledIdsRef = useRef(enabledIds)
  const scopeEpochRef = useRef(0)
  const loadPromiseRef = useRef<Promise<void>>(Promise.resolve())
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve())
  const savingCountRef = useRef(0)
  const loadSucceededRef = useRef(false)
  const failedMutationRef = useRef<{ id: string; enabled: boolean } | null>(null)

  useEffect(() => {
    const epoch = ++scopeEpochRef.current
    const defaults = defaultPluginIds()
    enabledIdsRef.current = defaults
    setEnabledIds(defaults)
    setIsLoading(true)
    savingCountRef.current = 0
    setIsSaving(false)
    setPersistenceError(null)
    setLoadFailed(false)
    loadSucceededRef.current = false
    failedMutationRef.current = null
    let cancelled = false
    const load = loadEnabledPluginIdsFromIDB(workspaceId)
      .then((fromIDB) => {
        if (cancelled || scopeEpochRef.current !== epoch) return
        const next = fromIDB ?? defaults
        enabledIdsRef.current = next
        setEnabledIds(next)
        loadSucceededRef.current = true
      })
      .catch((error: unknown) => {
        if (cancelled || scopeEpochRef.current !== epoch) return
        const message = error instanceof Error ? error.message : String(error)
        setPersistenceError(`插件设置读取失败：${message}`)
        setLoadFailed(true)
      })
      .finally(() => {
        if (!cancelled && scopeEpochRef.current === epoch) setIsLoading(false)
      })
    loadPromiseRef.current = load
    return () => {
      cancelled = true
    }
  }, [workspaceId, reloadVersion])

  // P2.9: 把启用集合投影给命令层，使禁用的插件既不在导航/抽屉里，也不再从命令面板可被呼出。
  useEffect(() => {
    projectEnabledPluginIds(enabledIds)
    return () => projectEnabledPluginIds(null)
  }, [enabledIds])

  const persistPluginChange = useCallback(
    (id: string, enabled: boolean | 'toggle') => {
      const epoch = scopeEpochRef.current
      let targetEnabled: boolean | null = null
      let persistenceAttempted = false
      savingCountRef.current += 1
      setIsSaving(true)
      const operation = mutationQueueRef.current
        .catch(() => {})
        .then(async () => {
          await loadPromiseRef.current
          if (scopeEpochRef.current !== epoch) return
          if (!loadSucceededRef.current) {
            throw new Error('当前作品的插件设置尚未成功读取，请先重新读取。')
          }
          const current = enabledIdsRef.current
          const nextEnabled = enabled === 'toggle' ? !current.has(id) : enabled
          targetEnabled = nextEnabled
          if (current.has(id) === nextEnabled) return
          const next = new Set(current)
          if (nextEnabled) next.add(id)
          else next.delete(id)
          setPersistenceError(null)
          persistenceAttempted = true
          await saveEnabledPluginIds(next, workspaceId)
          if (scopeEpochRef.current !== epoch) return
          failedMutationRef.current = null
          enabledIdsRef.current = next
          setEnabledIds(next)
        })
        .catch((error: unknown) => {
          if (scopeEpochRef.current === epoch) {
            if (persistenceAttempted && targetEnabled !== null) {
              failedMutationRef.current = { id, enabled: targetEnabled }
            }
            const message = error instanceof Error ? error.message : String(error)
            setPersistenceError(`插件设置保存失败：${message}`)
          }
          throw error
        })
        .finally(() => {
          if (scopeEpochRef.current === epoch) {
            savingCountRef.current = Math.max(0, savingCountRef.current - 1)
            setIsSaving(savingCountRef.current > 0)
          }
        })
      mutationQueueRef.current = operation
      return operation
    },
    [workspaceId],
  )

  const enablePlugin = useCallback(
    (id: string) => persistPluginChange(id, true),
    [persistPluginChange],
  )
  const disablePlugin = useCallback(
    (id: string) => persistPluginChange(id, false),
    [persistPluginChange],
  )
  const togglePlugin = useCallback(
    (id: string) => persistPluginChange(id, 'toggle'),
    [persistPluginChange],
  )
  const retrySave = useCallback(() => {
    const failedMutation = failedMutationRef.current
    return failedMutation
      ? persistPluginChange(failedMutation.id, failedMutation.enabled)
      : Promise.resolve()
  }, [persistPluginChange])

  const isPluginEnabled = useCallback((id: string) => enabledIds.has(id), [enabledIds])

  const value: PluginContextValue = {
    allPlugins: ALL_AVAILABLE_PLUGINS,
    activePlugins: ALL_AVAILABLE_PLUGINS.filter((p) => enabledIds.has(p.id)),
    enabledIds,
    workspaceId,
    isLoading,
    isSaving,
    persistenceError,
    loadFailed,
    dismissPersistenceError: () => setPersistenceError(null),
    retryLoad: () => setReloadVersion((version) => version + 1),
    retrySave,
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
