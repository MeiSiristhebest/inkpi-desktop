// clue-weaver 插件主入口

import type { DesktopPlugin } from '../../types/plugin'
import { ClueWeaverMasterView } from './components/ClueWeaverMasterView'
import { ClueWeaverDrawer } from './components/ClueWeaverDrawer'
import { Network } from 'lucide-react'

export const ClueWeaverPlugin: DesktopPlugin = {
  id: 'clue-weaver',
  name: '信息差认知织机',
  description: '认识论模态逻辑矩阵、天降全知实时巡检与多角色情报博弈量化',
  version: '1.0.0',
  author: 'InkPi Core Team',
  category: 'plot',
  tags: ['智斗', '信息差', '全知泄露', '悬疑', '认识论', '群像'],
  enabledByDefault: true,
  icon: Network,
  mainView: ClueWeaverMasterView,
  drawerSnippetView: ClueWeaverDrawer,
}

export * from './types'
export * from './engine/ClueWeaverEngine'
export * from './components/ClueWeaverMasterView'
export * from './components/ClueWeaverDrawer'
