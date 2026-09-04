import type { DesktopPlugin } from '../../types/plugin'
import { Flame } from 'lucide-react'
import { PaywallSentryMasterView } from './components/PaywallSentryMasterView'
import { PaywallSentryDrawer } from './components/PaywallSentryDrawer'

export const PaywallSentryPlugin: DesktopPlugin = {
  id: 'paywall-sentry',
  name: '付费卡点与首订哨兵',
  description: '基于 PPI 势能数学模型，智能评估上架卡点与章尾付费转化率',
  version: '1.0.0',
  author: 'InkPi Core Team',
  category: 'rhythm',
  tags: ['付费', '首订', 'VIP', '卡点', 'PPI势能', '断章'],
  enabledByDefault: true,
  icon: Flame,
  mainView: PaywallSentryMasterView,
  drawerSnippetView: PaywallSentryDrawer,
}

export * from './types'
export * from './engine/PaywallSentryEngine'
export * from './components/PaywallSentryMasterView'
export * from './components/PaywallSentryDrawer'
