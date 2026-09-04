// describe-palette 插件主入口

import type { DesktopPlugin } from '../../types/plugin'
import { DescribePaletteView } from './components/DescribePaletteView'
import { DescribePaletteDrawer } from './components/DescribePaletteDrawer'
import { Palette } from 'lucide-react'

export const DescribePalettePlugin: DesktopPlugin = {
  id: 'describe-palette',
  name: '修辞调色盘',
  description: '五感微观修辞调色盘、感官雷达诊断与多题材文学金句库',
  version: '1.0.0',
  author: 'InkPi Core Team',
  category: 'craft',
  tags: ['五感', '修辞', '调色盘', '通感', '描写金句'],
  enabledByDefault: true,
  icon: Palette,
  mainView: DescribePaletteView,
  drawerSnippetView: DescribePaletteDrawer,
}

export * from './types'
export * from './engine/DescribePaletteEngine'
export * from './components/DescribePaletteView'
export * from './components/DescribePaletteDrawer'
