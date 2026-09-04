import type { DesktopPlugin } from '../../types/plugin'
import { GitMerge } from 'lucide-react'
import { SubPlotBraidMasterView } from './components/SubPlotBraidMasterView'
import { SubPlotBraidDrawer } from './components/SubPlotBraidDrawer'

export const SubPlotBraidPlugin: DesktopPlugin = {
  id: 'sub-plot-braid',
  name: '多线叙事编织器',
  description: '宏观副线休眠饥饿度监控、交汇高潮点推演与长篇多线网格合流罗盘',
  version: '1.0.0',
  author: 'InkPi Core Team',
  category: 'plot',
  tags: ['多线', '支线', '合流', '大纲', '饥饿度', '编织拓扑'],
  enabledByDefault: true,
  icon: GitMerge,
  mainView: SubPlotBraidMasterView,
  drawerSnippetView: SubPlotBraidDrawer,
}

export * from './types'
export * from './engine/SubPlotBraidEngine'
export * from './components/SubPlotBraidMasterView'
export * from './components/SubPlotBraidDrawer'
