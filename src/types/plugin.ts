import type { ComponentType } from 'react'

export type DesktopPluginCategory =
  | 'lore'      // 设定与世界书套件
  | 'plot'      // 大纲与因果套件
  | 'review'    // 质检与门禁套件
  | 'craft'     // 修辞与调色套件
  | 'rhythm'    // 网文节奏套件
  | 'flow'      // 心流与竞技套件
  | 'tools'     // 辅助与工具

export interface DesktopPluginViewProps {
  projectId: string
  onStats?: (stats: { title?: string; wordCount: number; updatedAt?: number }) => void
}

export interface DesktopPluginDrawerProps {
  projectId: string
  currentText: string
  onOpenDetail?: (entityId: string) => void
}

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
  
  // 3. AI 提示词扩展或工具能力
  aiCapabilities?: {
    systemPromptEnhancer?: (projectId: string, currentText: string) => Promise<string>
  }
}

export interface PluginRegistryState {
  plugins: DesktopPlugin[]
  enabledPluginIds: Set<string>
}
