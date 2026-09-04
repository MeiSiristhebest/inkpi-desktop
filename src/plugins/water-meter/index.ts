// water-meter 插件主入口

import type { DesktopPlugin } from '../../types/plugin'
import { WaterMeterMasterView } from './components/WaterMeterMasterView'
import { WaterMeterDrawer } from './components/WaterMeterDrawer'
import { Droplet } from 'lucide-react'

export const WaterMeterPlugin: DesktopPlugin = {
  id: 'water-meter',
  name: '水分压缩计',
  description: '香农信息熵测算、假动作与套话净化、长篇连载叙事动能评估',
  version: '1.0.0',
  author: 'InkPi Core Team',
  category: 'review',
  tags: ['去水', '信息熵', '套话', '假动作', '精修', '质检'],
  enabledByDefault: true,
  icon: Droplet,
  mainView: WaterMeterMasterView,
  drawerSnippetView: WaterMeterDrawer,
}

export * from './types'
export * from './engine/WaterMeterEngine'
export * from './components/WaterMeterMasterView'
export * from './components/WaterMeterDrawer'
