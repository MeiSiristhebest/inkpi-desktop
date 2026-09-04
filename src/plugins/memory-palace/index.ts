import type { DesktopPlugin } from '../../types/plugin'
import { Sparkles } from 'lucide-react'
import { MemoryPalaceMasterView } from './components/MemoryPalaceMasterView'
import { MemoryPalaceDrawer } from './components/MemoryPalaceDrawer'

export const MemoryPalacePlugin: DesktopPlugin = {
  id: 'memory-palace',
  name: '记忆宫殿与实体召回仪',
  description: '百万字长篇跨卷实体倒排检索与历史登场轨迹即时闪回',
  version: '1.0.0',
  author: 'InkPi Core Team',
  category: 'tools',
  tags: ['记忆宫殿', '实体', '召回', '历史登场', '倒排索引', '伏笔轨迹'],
  enabledByDefault: true,
  icon: Sparkles,
  mainView: MemoryPalaceMasterView,
  drawerSnippetView: MemoryPalaceDrawer,
}

export * from './types'
export * from './engine/MemoryPalaceEngine'
export * from './components/MemoryPalaceMasterView'
export * from './components/MemoryPalaceDrawer'
