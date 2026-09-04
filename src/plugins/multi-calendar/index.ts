import type { DesktopPlugin } from '../../types/plugin'
import { Calendar } from 'lucide-react'
import { MultiCalendarMasterView } from './components/MultiCalendarMasterView'
import { MultiCalendarDrawer } from './components/MultiCalendarDrawer'

export const MultiCalendarPlugin: DesktopPlugin = {
  id: 'multi-calendar',
  name: '跨纪元多历法与故事时间轴引擎',
  description: '并行史诗历法体系定义、全宇宙绝对标量日双向换算、跨卷期编年史与时间倒流悖论巡检',
  version: '1.0.0',
  author: 'InkPi Core Team',
  category: 'plot',
  tags: ['多历法', '故事时间轴', '编年史', '时间悖论', '绝对标量日'],
  enabledByDefault: true,
  icon: Calendar,
  mainView: MultiCalendarMasterView,
  drawerSnippetView: MultiCalendarDrawer,
}

export * from './types'
export * from './engine/MultiCalendarEngine'
export * from './components/MultiCalendarMasterView'
export * from './components/MultiCalendarDrawer'
