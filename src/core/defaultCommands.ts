import { commandRegistry, type Command } from './commandRegistry'
import { CAPABILITY_REGISTRY } from './capabilityRegistry'
import type { InspectorSurface } from '../types/inspectorState'

export interface NavigationHandler {
  openView: (tabId: string) => void
  openAssistant: () => void
  openActivityCenter?: () => void
  openSettings?: () => void
  openInspector?: (surface: InspectorSurface, pluginId?: string) => void
  openDrawer?: (pluginId: string) => void
  saveCurrentChapter?: () => Promise<void> | void
}

let activeNavigationHandler: NavigationHandler | null = null

export function setNavigationHandler(handler: NavigationHandler | null): void {
  activeNavigationHandler = handler
}

export function registerDefaultCommands(): () => void {
  const unregisterCallbacks: Array<() => void> = []

  // 1. 核心视图导航命令
  const coreViewCommands: Command[] = [
    {
      id: 'cmd-nav-editor',
      title: '切换到正文编辑器',
      keywords: ['editor', 'write', '正文', '写作', '编辑'],
      shortcut: 'Mod+1',
      category: 'edit',
      execute: () => {
        activeNavigationHandler?.openView('editor')
      },
    },
    {
      id: 'cmd-nav-dashboard',
      title: '切换到数据大屏与全书概览',
      keywords: ['dashboard', 'stats', '概览', '大屏', '统计'],
      shortcut: 'Mod+2',
      category: 'view',
      execute: () => {
        activeNavigationHandler?.openView('dashboard')
      },
    },
    {
      id: 'cmd-open-assistant',
      title: '打开 AI 副驾驶',
      keywords: ['ai', 'copilot', 'assistant', '副驾驶', '对话'],
      shortcut: 'Mod+J',
      category: 'intelligence',
      execute: () => {
        if (activeNavigationHandler?.openInspector) {
          activeNavigationHandler.openInspector('assistant')
        } else {
          activeNavigationHandler?.openAssistant()
        }
      },
    },
    {
      id: 'cmd-open-activity-center',
      title: '打开 AI 任务执行与活动中心',
      keywords: ['activity', 'tasks', 'recovery', '活动中心', '任务', '后台'],
      category: 'intelligence',
      execute: () => {
        if (activeNavigationHandler?.openInspector) {
          activeNavigationHandler.openInspector('activity')
        } else if (activeNavigationHandler?.openActivityCenter) {
          activeNavigationHandler.openActivityCenter()
        } else {
          activeNavigationHandler?.openAssistant()
        }
      },
    },
    {
      id: 'cmd-open-settings',
      title: '打开系统设置',
      keywords: ['settings', 'config', '设置', '偏好', '模型'],
      shortcut: 'Mod+,',
      category: 'system',
      execute: () => {
        activeNavigationHandler?.openSettings?.()
      },
    },
  ]

  for (const cmd of coreViewCommands) {
    unregisterCallbacks.push(commandRegistry.register(cmd))
  }

  // 2. 从 CAPABILITY_REGISTRY 动态注册已收敛能力，依据 surface 精准分发
  for (const cap of Object.values(CAPABILITY_REGISTRY)) {
    const surfaces = cap.surfaces as readonly string[]
    const isNavigation = surfaces.includes('navigation') || surfaces.includes('canvas')
    const isInspector = surfaces.includes('inspector')
    const isDrawer = surfaces.includes('drawer')
    const categoryStr = cap.category as string

    // 动态生成恰当的动词描述
    const actionLabel = isNavigation
      ? '打开'
      : isInspector
        ? '在右栏审查'
        : isDrawer
          ? '呼出抽屉'
          : '执行'

    const cmd: Command = {
      id: `cmd-capability-${cap.id}`,
      title: `${actionLabel} ${cap.name}`,
      keywords: [cap.id, cap.name, cap.category, '插件', '模块'],
      category:
        categoryStr === 'worldbuilding'
          ? 'worldbuilding'
          : categoryStr === 'plot' || categoryStr === 'core'
            ? 'continuity'
            : categoryStr === 'intelligence'
              ? 'intelligence'
              : 'view',
      execute: () => {
        if (isNavigation) {
          activeNavigationHandler?.openView(cap.id)
        } else if (isInspector) {
          if (activeNavigationHandler?.openInspector) {
            activeNavigationHandler.openInspector('plugin', cap.id)
          } else if (activeNavigationHandler?.openDrawer) {
            activeNavigationHandler.openDrawer(cap.id)
          }
        } else if (isDrawer) {
          activeNavigationHandler?.openDrawer?.(cap.id)
        }
      },
    }
    unregisterCallbacks.push(commandRegistry.register(cmd))
  }

  return () => {
    for (const unreg of unregisterCallbacks) {
      unreg()
    }
  }
}
