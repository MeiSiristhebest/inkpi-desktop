// expectation-engine 插件主入口

import type { DesktopPlugin } from '../../types/plugin'
import { ExpectationMasterView } from './components/ExpectationMasterView'
import { ExpectationDrawer } from './components/ExpectationDrawer'
import { Sparkles } from 'lucide-react'

export const ExpectationEnginePlugin: DesktopPlugin = {
  id: 'expectation-engine',
  name: '爽点调度',
  description: '爽点与期待感曲线调度器、压抑释放比率（SPR）与黄金三章体检',
  version: '1.0.0',
  author: 'InkPi Core Team',
  category: 'rhythm',
  tags: ['期待感', '爽点', '黄金三章', 'SPR', '追读率'],
  enabledByDefault: true,
  icon: Sparkles,
  mainView: ExpectationMasterView,
  drawerSnippetView: ExpectationDrawer,
}

export * from './types'
export { GoldChaptersEngine } from '../gold-chapters-eval/engine/GoldChaptersEngine'
export type { GoldChaptersEvaluation, GoldChapterEvalRecord } from '../gold-chapters-eval/types'
export * from './engine/ExpectationEngine'
export * from './components/ExpectationMasterView'
export * from './components/ExpectationDrawer'
