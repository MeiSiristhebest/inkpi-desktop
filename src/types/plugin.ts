import type { ComponentType } from 'react'

export type DesktopPluginCategory = 'lore' | 'plot' | 'character' | 'review' | 'craft' | 'tools'

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
  category: DesktopPluginCategory
  icon: ComponentType<{ className?: string }>
  
  // 1. 主视口挂载组件 (点击左侧导航后在主区渲染)
  mainView: ComponentType<DesktopPluginViewProps>
  
  // 2. 写作台 HUD 随动抽屉组件 (可选，在 WriterDesk 右侧栏嵌入随动感知)
  drawerSnippetView?: ComponentType<DesktopPluginDrawerProps>
  
  // 3. AI 提示词扩展或工具能力
  aiCapabilities?: {
    systemPromptEnhancer?: (projectId: string, currentText: string) => Promise<string>
  }
}
