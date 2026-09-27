import type { FC } from 'react'
import { X } from 'lucide-react'
import { useOptionalPluginRegistry } from '../../../core/pluginRegistry'
import { useOptionalPluginHostContext } from '../../../core/pluginHostContext'
import { PLUGIN_DRAWER_CAPABILITIES } from '../../../core/capabilityRegistry'
import { IconButton } from '../../../ui/atoms/IconButton'
import { Tooltip } from '../../../ui/primitives'

interface DrawerDockProps {
  projectId: string
  currentText: string
}

export const DrawerDock: FC<DrawerDockProps> = ({ projectId, currentText }) => {
  const registry = useOptionalPluginRegistry()
  const host = useOptionalPluginHostContext()

  if (!registry || !host || !host.activeDrawerPluginId) {
    return null
  }

  const activePlugin = registry.activePlugins.find((p) => p.id === host.activeDrawerPluginId)
  if (!activePlugin || !activePlugin.drawerSnippetView) {
    return null
  }

  const DrawerComponent = activePlugin.drawerSnippetView
  const IconComponent = activePlugin.icon
  // §P2.8：抽屉打开时也要说清它是三类能力里的哪一类，作者才知道自己在检视、动手还是看诊断。
  const capability = PLUGIN_DRAWER_CAPABILITIES.find(
    (item) => item.id === activePlugin.drawerCapability,
  )

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
        <DrawerComponent projectId={projectId} currentText={currentText} />
      </div>
    </aside>
  )
}
