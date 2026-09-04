import type { DesktopPlugin } from '../../types/plugin'
import { Crosshair } from 'lucide-react'
import { ChekhovRadarMasterView } from './components/ChekhovRadarMasterView'
import { ChekhovRadarDrawer } from './components/ChekhovRadarDrawer'

export const ChekhovRadarPlugin: DesktopPlugin = {
  id: 'chekhov-radar',
  name: '契诃夫之枪与全景伏笔闭合雷达',
  description: '百万字长篇伏笔锈蚀半衰期追踪、线索死锁闭环率推演与防烂尾预警引擎',
  version: '1.0.0',
  author: 'InkPi Core Team',
  category: 'plot',
  tags: ['契诃夫之枪', '伏笔', '闭环', '烂尾预警', '线索链'],
  enabledByDefault: true,
  icon: Crosshair,
  mainView: ChekhovRadarMasterView,
  drawerSnippetView: ChekhovRadarDrawer,
}

export * from './types'
export * from './engine/ChekhovRadarEngine'
export * from './components/ChekhovRadarMasterView'
export * from './components/ChekhovRadarDrawer'
