// consistency-sentinel 插件主入口

import type { DesktopPlugin } from '../../types/plugin'
import { ConsistencyMasterView } from './components/ConsistencyMasterView'
import { ConsistencyDrawer } from './components/ConsistencyDrawer'
import { ShieldAlert } from 'lucide-react'

export const ConsistencySentinelPlugin: DesktopPlugin = {
  id: 'consistency-sentinel',
  name: '设定哨兵',
  description: '战力阶梯偏序有向图、越阶杀敌失真与死者复生等设定吃书巡检',
  version: '1.0.0',
  author: 'InkPi Core Team',
  category: 'review',
  tags: ['战力', '设定自洽', '吃书', '死者复生', '逻辑审查'],
  enabledByDefault: true,
  icon: ShieldAlert,
  mainView: ConsistencyMasterView,
  drawerSnippetView: ConsistencyDrawer,
}

export * from './types'
export * from './engine/ConsistencyEngine'
export * from './components/ConsistencyMasterView'
export * from './components/ConsistencyDrawer'
