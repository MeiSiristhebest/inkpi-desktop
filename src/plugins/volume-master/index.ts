// volume-master 插件主入口

import type { DesktopPlugin } from '../../types/plugin'
import { VolumeMasterMasterView } from './components/VolumeMasterMasterView'
import { VolumeMasterDrawer } from './components/VolumeMasterDrawer'
import { Compass } from 'lucide-react'

export const VolumeMasterPlugin: DesktopPlugin = {
  id: 'volume-master',
  name: '分卷弧光罗盘',
  description: '百万字长篇分形分卷四幕架构、字数燃烧率 WBR 监控与跨卷高潮锚点管理',
  version: '1.0.0',
  author: 'InkPi Core Team',
  category: 'plot',
  tags: ['分卷', '宏观架构', '百万字', '戏剧弧', '高潮锚点', '字数预算'],
  enabledByDefault: true,
  icon: Compass,
  mainView: VolumeMasterMasterView,
  drawerSnippetView: VolumeMasterDrawer,
}

export * from './types'
export * from './engine/VolumeMasterEngine'
export * from './components/VolumeMasterMasterView'
export * from './components/VolumeMasterDrawer'
