import type { ComponentType } from 'react'

export type DesktopPluginCategory =
  | 'lore' // 设定与世界书套件
  | 'plot' // 大纲与因果套件
  | 'review' // 质检与门禁套件
  | 'craft' // 修辞与调色套件
  | 'rhythm' // 网文节奏套件
  | 'flow' // 心流与竞技套件
  | 'tools' // 辅助与工具

/**
 * 抽屉只有这三类能力形态（§P2.8）：插件可以换，形态不换。
 * 每个抽屉在注册表里就必须声明自己属于哪一类，否则「再来一个抽屉」无法通过类型检查。
 */
export type PluginDrawerCapability = 'context-inspector' | 'quick-action' | 'live-diagnostic'

export interface DesktopPluginViewProps {
  projectId: string
  onStats?: (stats: { title?: string; wordCount: number; updatedAt?: number }) => void
}

export interface DesktopPluginDrawerProps {
  projectId: string
  currentText: string
  onOpenDetail?: (entityId: string) => void
}

export interface PluginContextRequest {
  projectId: string
  currentText: string
  activeChapterId?: string
}

export interface PluginContextFragment {
  id: string
  source: string
  kind: string
  data: unknown
  priority?: number
  metadata?: Record<string, unknown>
}

export type PluginContextProvider = (
  request: PluginContextRequest,
) => Promise<PluginContextFragment | null>

export interface DesktopPlugin {
  id: string
  name: string
  description: string
  version: string
  author?: string
  category: DesktopPluginCategory
  icon: ComponentType<{ className?: string }>
  tags?: string[]
  enabledByDefault?: boolean

  // 1. 主视口挂载组件 (点击左侧导航后在主区渲染)
  mainView: ComponentType<DesktopPluginViewProps>

  // 2. 写作台 HUD 随动抽屉组件 (可选，在 RichEditor 右侧栏嵌入随动感知)
  drawerSnippetView?: ComponentType<DesktopPluginDrawerProps>
  /** 这个抽屉属于哪一类能力（§P2.8）。与 drawerSnippetView 成对出现，由注册表声明。 */
  drawerCapability?: PluginDrawerCapability

  // 3. 结构化上下文贡献者；指令和模型选择由统一任务运行时负责。
  contextProvider?: PluginContextProvider
}

export interface PluginRegistryState {
  plugins: DesktopPlugin[]
  enabledPluginIds: Set<string>
}
