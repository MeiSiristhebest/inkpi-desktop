import { commandRegistry, type Command } from './commandRegistry'
import { CAPABILITY_REGISTRY } from './capabilityRegistry'

export interface NavigationHandler {
  openView: (tabId: string) => void
  openAssistant: () => void
  openActivityCenter?: () => void
  openSettings?: () => void
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
        activeNavigationHandler?.openAssistant()
      },
    },
    {
      id: 'cmd-open-activity-center',
      title: '打开 AI 任务执行与活动中心',
      keywords: ['activity', 'tasks', 'recovery', '活动中心', '任务', '后台'],
      category: 'intelligence',
      execute: () => {
        if (activeNavigationHandler?.openActivityCenter) {
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

  // 2. 从 CAPABILITY_REGISTRY 动态注册已收敛能力
  for (const cap of Object.values(CAPABILITY_REGISTRY)) {
    const surfaces = cap.surfaces as readonly string[]
    const isNavigation = surfaces.includes('navigation') || surfaces.includes('canvas')
    const categoryStr = cap.category as string
    const cmd: Command = {
      id: `cmd-capability-${cap.id}`,
      title: `打开 ${cap.name}`,
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
