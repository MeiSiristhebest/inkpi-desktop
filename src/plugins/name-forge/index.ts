// name-forge 插件主入口

import type { DesktopPlugin } from '../../types/plugin'
import { NameForgeView } from './components/NameForgeView'
import { NameForgeDrawer } from './components/NameForgeDrawer'
import { Sparkles } from 'lucide-react'

export const NameForgePlugin: DesktopPlugin = {
  id: 'name-forge',
  name: '起名姬',
  description: '中西奇幻起名姬、平仄音律文法与活体世界观图谱一键收录',
  version: '1.0.0',
  author: 'InkPi Core Team',
  category: 'tools',
  tags: ['起名', '设定', '功法', '法宝', '宗门', '音律'],
  enabledByDefault: true,
  icon: Sparkles,
  mainView: NameForgeView,
  drawerSnippetView: NameForgeDrawer,
}

export * from './types'
export * from './engine/NameForgeEngine'
export * from './components/NameForgeView'
export * from './components/NameForgeDrawer'
