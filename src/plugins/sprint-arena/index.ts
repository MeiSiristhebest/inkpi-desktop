// sprint-arena 插件主入口

import type { DesktopPlugin } from '../../types/plugin'
import { SprintArenaMasterView } from './components/SprintArenaMasterView'
import { SprintArenaDrawer } from './components/SprintArenaDrawer'
import { Flame } from 'lucide-react'

export const SprintArenaPlugin: DesktopPlugin = {
  id: 'sprint-arena',
  name: '冲刺擂台',
  description: '心流极速码字冲刺、实时击键心电图与机械打字机声学算法',
  version: '1.0.0',
  author: 'InkPi Core Team',
  category: 'flow',
  tags: ['心流', '冲刺', '番茄钟', '打字机音效', 'WPM'],
  enabledByDefault: true,
  icon: Flame,
  mainView: SprintArenaMasterView,
  drawerSnippetView: SprintArenaDrawer,
}

export * from './types'
export * from './engine/SprintEngine'
export * from './components/SprintArenaMasterView'
export * from './components/SprintArenaDrawer'
