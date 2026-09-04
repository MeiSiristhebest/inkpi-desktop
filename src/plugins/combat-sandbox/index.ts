import type { DesktopPlugin } from '../../types/plugin'
import { Swords } from 'lucide-react'
import { CombatSandboxMasterView } from './components/CombatSandboxMasterView'
import { CombatSandboxDrawer } from './components/CombatSandboxDrawer'

export const CombatSandboxPlugin: DesktopPlugin = {
  id: 'combat-sandbox',
  name: '东方玄幻战力与拆招沙盘',
  description: '境界天梯能级压制、越级反杀代价配平算子、战力崩塌自动预警与四段博弈拆招沙盘',
  version: '1.0.0',
  author: 'InkPi Core Team',
  category: 'plot',
  tags: ['战力沙盘', '境界天梯', '拆招博弈', '防战力崩坏', '玄幻决战'],
  enabledByDefault: true,
  icon: Swords,
  mainView: CombatSandboxMasterView,
  drawerSnippetView: CombatSandboxDrawer,
}

export * from './types'
export * from './engine/CombatSandboxEngine'
export * from './components/CombatSandboxMasterView'
export * from './components/CombatSandboxDrawer'
