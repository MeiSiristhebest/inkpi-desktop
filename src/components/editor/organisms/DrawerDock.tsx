import type { FC } from 'react'
import { X } from 'lucide-react'
import { useOptionalPluginRegistry } from '../../../core/pluginRegistry'
import { useOptionalPluginHostContext } from '../../../core/pluginHostContext'
import { IconButton } from '../../../ui/atoms/IconButton'

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

  const activePlugin = registry.allPlugins.find((p) => p.id === host.activeDrawerPluginId)
  if (!activePlugin || !activePlugin.drawerSnippetView) {
    return null
  }

  const DrawerComponent = activePlugin.drawerSnippetView
  const IconComponent = activePlugin.icon

  return (
    <aside
      data-testid="editor-plugin-drawer-dock"
      className="w-80 h-full shrink-0 border-l border-[var(--ink-border)] bg-[var(--ink-bg-panel)] flex flex-col z-20 shadow-sm animate-in slide-in-from-right duration-200"
    >
      <div className="h-10 shrink-0 px-3 border-b border-[var(--ink-border)] flex items-center justify-between bg-[var(--ink-bg)]/50">
        <div className="flex items-center gap-2 min-w-0">
          {IconComponent && <IconComponent className="w-4 h-4 text-[var(--ink-accent)] shrink-0" />}
          <span className="text-xs font-medium truncate text-[var(--ink-text)]">
            {activePlugin.name}
          </span>
        </div>
        <IconButton
          onClick={() => host.closeDrawer()}
          title="关闭插件抽屉"
          className="hover:bg-[var(--ink-bg-hover)]"
        >
          <X className="w-3.5 h-3.5" />
        </IconButton>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        <DrawerComponent projectId={projectId} currentText={currentText} />
      </div>
    </aside>
  )
}
