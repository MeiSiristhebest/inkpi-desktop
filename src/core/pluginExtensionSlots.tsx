import { Suspense, type FC } from 'react'
import type {
  PluginBookshelfActionProps,
  PluginDashboardExtensionProps,
  PluginTaskContextProps,
} from '../types/plugin'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { ALL_AVAILABLE_PLUGINS, useOptionalPluginRegistry } from './pluginRegistry'

function useActivePlugins() {
  const registry = useOptionalPluginRegistry()
  return registry?.activePlugins ?? ALL_AVAILABLE_PLUGINS
}

function ExtensionError({ pluginName }: { pluginName: string }) {
  return (
    <span role="alert" className="text-[11px] text-[var(--ink-danger)]">
      {pluginName} 扩展暂时不可用。
    </span>
  )
}

export const PluginBookshelfActionSlot: FC<PluginBookshelfActionProps> = (props) => {
  const registry = useOptionalPluginRegistry()
  // Library-level actions (such as importing into a selected work) must remain available
  // after returning from a work whose plugin set is project-scoped.
  const plugins = (registry?.allPlugins ?? ALL_AVAILABLE_PLUGINS).filter(
    (plugin) => plugin.bookshelfActionView,
  )
  return (
    <>
      {plugins.map((plugin) => {
        const Action = plugin.bookshelfActionView
        if (!Action) return null
        return (
          <ErrorBoundary
            key={plugin.id}
            label={plugin.name}
            fallback={() => <ExtensionError pluginName={plugin.name} />}
          >
            <Suspense fallback={null}>
              <Action {...props} />
            </Suspense>
          </ErrorBoundary>
        )
      })}
    </>
  )
}

export const PluginDashboardExtensionSlot: FC<PluginDashboardExtensionProps> = (props) => {
  const plugins = useActivePlugins()
  return (
    <>
      {plugins.map((plugin) => {
        const Extension = plugin.dashboardExtensionView
        if (!Extension) return null
        return (
          <ErrorBoundary
            key={plugin.id}
            label={plugin.name}
            fallback={() => <ExtensionError pluginName={plugin.name} />}
          >
            <Suspense fallback={null}>
              <Extension {...props} />
            </Suspense>
          </ErrorBoundary>
        )
      })}
    </>
  )
}

export const PluginTaskContextSlot: FC<PluginTaskContextProps> = (props) => {
  const plugins = useActivePlugins()
  return (
    <>
      {plugins.map((plugin) => {
        const Extension = plugin.taskContextView
        if (!Extension) return null
        return (
          <ErrorBoundary
            key={plugin.id}
            label={plugin.name}
            fallback={() => <ExtensionError pluginName={plugin.name} />}
          >
            <Suspense fallback={null}>
              <Extension {...props} />
            </Suspense>
          </ErrorBoundary>
        )
      })}
    </>
  )
}
