// safe-gate 插件主入口

import type { DesktopPlugin } from '../../types/plugin'
import { SafeGateView } from './components/SafeGateView'
import { SafeGateDrawer } from './components/SafeGateDrawer'
import { ShieldAlert } from 'lucide-react'

export const SafeGatePlugin: DesktopPlugin = {
  id: 'safe-gate',
  name: '敏感审查',
  description: '三级敏感词审查、离线词库极速匹配与文学平替自适应建议',
  version: '1.0.0',
  author: 'InkPi Core Team',
  category: 'review',
  tags: ['敏感词', '审查', '文学平替', '质检门禁'],
  enabledByDefault: true,
  icon: ShieldAlert,
  mainView: SafeGateView,
  drawerSnippetView: SafeGateDrawer,
}

export * from './types'
export * from './engine/SafeGateEngine'
export * from './components/SafeGateView'
export * from './components/SafeGateDrawer'
