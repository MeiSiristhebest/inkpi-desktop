import { Suspense, useMemo, useState, type FC } from 'react'
import { X } from 'lucide-react'
import { ErrorBoundary } from '../../ErrorBoundary'
import { useOptionalPluginRegistry } from '../../../core/pluginRegistry'
import { useOptionalPluginHostContext } from '../../../core/pluginHostContext'
import { PLUGIN_DRAWER_CAPABILITIES } from '../../../core/capabilityRegistry'
import { IconButton } from '../../../ui/atoms/IconButton'
import { Button, Tooltip } from '../../../ui/primitives'

interface DrawerDockProps {
  projectId: string
  currentText: string
  currentChapterNumber?: number | null
  retryAfterLoadError?: {
    persistDraft: () => Promise<boolean>
    reload: () => void
  }
}

export const DrawerDock: FC<DrawerDockProps> = ({
  projectId,
  currentText,
  currentChapterNumber,
  retryAfterLoadError,
}) => {
  const registry = useOptionalPluginRegistry()
  const host = useOptionalPluginHostContext()
  const activeDrawerPluginId = host?.activeDrawerPluginId ?? null
  const activePlugin = registry?.activePlugins.find((p) => p.id === activeDrawerPluginId)
  const [retryState, setRetryState] = useState<{ pluginId: string | null; attempts: number }>({
    pluginId: null,
    attempts: 0,
  })
  const [isPreparingReload, setIsPreparingReload] = useState(false)
  const [reloadPreparationError, setReloadPreparationError] = useState<string | null>(null)
  const retryCount =
    activePlugin && retryState.pluginId === activePlugin.id ? retryState.attempts : 0
  const DrawerComponent = useMemo(() => {
    if (!activePlugin?.drawerSnippetView) return undefined
    return retryCount > 0
      ? (activePlugin.createDrawerSnippetView?.() ?? activePlugin.drawerSnippetView)
      : activePlugin.drawerSnippetView
  }, [activePlugin, retryCount])

  if (!registry || !host || !activeDrawerPluginId) {
    return null
  }

  if (!activePlugin || !DrawerComponent) {
    return null
  }

  const IconComponent = activePlugin.icon
  // §P2.8：抽屉打开时也要说清它是三类能力里的哪一类，作者才知道自己在检视、动手还是看诊断。
  const capability = PLUGIN_DRAWER_CAPABILITIES.find(
    (item) => item.id === activePlugin.drawerCapability,
  )

  const handleRetry = async () => {
    setReloadPreparationError(null)
    if (!retryAfterLoadError) {
      setRetryState((current) => ({
        pluginId: activePlugin.id,
        attempts: current.pluginId === activePlugin.id ? current.attempts + 1 : 1,
      }))
      return
    }

    setIsPreparingReload(true)
    try {
      if (!(await retryAfterLoadError.persistDraft())) {
        setReloadPreparationError('正文保存失败，页面未刷新。请处理保存错误后再重试。')
        return
      }
      retryAfterLoadError.reload()
    } catch (error) {
      setReloadPreparationError(
        `正文保存失败，页面未刷新。${error instanceof Error ? error.message : String(error)}`,
      )
    } finally {
      setIsPreparingReload(false)
    }
  }

  return (
    <aside
      data-testid="editor-plugin-drawer-dock"
      className="editor-plugin-drawer-dock w-80 h-full shrink-0 border-l border-[var(--ink-border)] bg-[var(--ink-bg-panel)] flex flex-col z-20 shadow-sm animate-in slide-in-from-right duration-200"
    >
      <div className="shrink-0 px-3 py-1.5 border-b border-[var(--ink-border)] bg-[var(--ink-bg)]/50">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {IconComponent && (
              <IconComponent className="w-4 h-4 text-[var(--ink-accent)] shrink-0" />
            )}
            <span className="text-xs font-medium truncate text-[var(--ink-text)]">
              {activePlugin.name}
            </span>
            {capability && (
              <span
                data-testid="editor-plugin-drawer-category"
                className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--ink-accent-soft)] text-[var(--ink-accent)]"
              >
                {capability.label}
              </span>
            )}
          </div>
          <Tooltip content="关闭插件抽屉">
            <IconButton
              label="关闭插件抽屉"
              onClick={() => host.closeDrawer()}
              className="hover:bg-[var(--ink-bg-hover)]"
            >
              <X className="w-3.5 h-3.5" />
            </IconButton>
          </Tooltip>
        </div>
        {capability && (
          <p className="mt-0.5 text-[10px] leading-snug text-[var(--ink-text-muted)]">
            {capability.hint}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        <ErrorBoundary
          key={`${projectId}:${activePlugin.id}:${retryCount}`}
          label={`${activePlugin.name}抽屉`}
          fallback={(error) => (
            <div
              role="alert"
              data-testid="editor-plugin-drawer-error"
              className="m-3 rounded-lg border border-red-500/40 bg-red-500/5 p-3 text-xs text-[var(--ink-text)]"
            >
              <p className="font-medium text-red-600 dark:text-red-400">插件抽屉加载失败</p>
              <p className="mt-1 text-[var(--ink-text-muted)]">
                正文和草稿仍可继续使用。{error.message}
              </p>
              {retryAfterLoadError && (
                <p className="mt-1 text-[var(--ink-text-muted)]">
                  刷新后请重新进入作品并打开此插件抽屉。
                </p>
              )}
              {reloadPreparationError && (
                <p role="status" className="mt-1 text-red-600 dark:text-red-400">
                  {reloadPreparationError}
                </p>
              )}
              <Button
                size="sm"
                isLoading={isPreparingReload}
                loadingText="正在保存正文…"
                onClick={() => void handleRetry()}
                className="mt-2 rounded-md bg-[var(--ink-accent)] text-xs font-medium text-white hover:bg-[var(--ink-accent)]"
              >
                {retryAfterLoadError ? '保存正文并刷新' : '重试插件抽屉'}
              </Button>
            </div>
          )}
        >
          <Suspense
            fallback={
              <div
                role="status"
                data-testid="editor-plugin-drawer-loading"
                className="p-3 text-xs text-[var(--ink-text-muted)]"
              >
                正在加载{activePlugin.name}抽屉…
              </div>
            }
          >
            <DrawerComponent
              projectId={projectId}
              currentText={currentText}
              currentChapterNumber={currentChapterNumber ?? null}
            />
          </Suspense>
        </ErrorBoundary>
      </div>
    </aside>
  )
}
