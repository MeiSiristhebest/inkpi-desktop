// timeline-grid 插件主入口

import type { DesktopPlugin } from '../../types/plugin'
import { TimelineGridView } from './components/TimelineGridView'
import { GitGraph } from 'lucide-react'

export const TimelineGridPlugin: DesktopPlugin = {
  id: 'timeline-grid',
  name: '时空大纲',
  description: '双维时空大纲网格、因果 DAG 拓扑排序与时间悖论实时校验',
  version: '1.0.0',
  author: 'InkPi Core Team',
  category: 'plot',
  tags: ['时空大纲', '多线叙事', '因果拓扑', '时间线'],
  enabledByDefault: true,
  icon: GitGraph,
  mainView: TimelineGridView,
}

export * from './types'
export { SubPlotBraidEngine } from '../sub-plot-braid/engine/SubPlotBraidEngine'
export type { SubPlotStrand, ThreadHealthMetric } from '../sub-plot-braid/types'
export * from './engine/CausalEngine'
export * from './components/TimelineGridView'
export * from './components/TimelineNodeCard'
export * from './components/ConflictPanel'
