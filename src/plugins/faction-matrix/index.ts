// faction-matrix 插件主入口

import type { DesktopPlugin } from '../../types/plugin'
import { FactionMatrixMasterView } from './components/FactionMatrixMasterView'
import { FactionMatrixDrawer } from './components/FactionMatrixDrawer'
import { Shield } from 'lucide-react'

export const FactionMatrixPlugin: DesktopPlugin = {
  id: 'faction-matrix',
  name: '势力地缘沙盘',
  description: '地缘政治符号网络结构平衡、主角全宗门声望天平与大事件涟漪推演',
  version: '1.0.0',
  author: 'InkPi Core Team',
  category: 'lore',
  tags: ['势力', '门派', '地缘政治', '声望', '涟漪推演', '结构平衡'],
  enabledByDefault: true,
  icon: Shield,
  mainView: FactionMatrixMasterView,
  drawerSnippetView: FactionMatrixDrawer,
}

export * from './types'
export * from './engine/FactionMatrixEngine'
export * from './components/FactionMatrixMasterView'
export * from './components/FactionMatrixDrawer'
