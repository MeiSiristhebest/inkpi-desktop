import type { DesktopPlugin } from '../../types/plugin'
import { Activity } from 'lucide-react'
import { RhythmMetronomeMasterView } from './components/RhythmMetronomeMasterView'
import { RhythmMetronomeDrawer } from './components/RhythmMetronomeDrawer'

export const RhythmMetronomePlugin: DesktopPlugin = {
  id: 'rhythm-metronome',
  name: '商业网文黄金节拍器与高潮节律仪',
  description: '黄金 3-15-50 章三层嵌套自驱推进力学模型、水文停滞预警与高潮步频节拍器',
  version: '1.0.0',
  author: 'InkPi Core Team',
  category: 'flow',
  tags: ['网文节拍', '高潮推进', '水文预警', '节奏律动', '循环步频'],
  enabledByDefault: true,
  icon: Activity,
  mainView: RhythmMetronomeMasterView,
  drawerSnippetView: RhythmMetronomeDrawer,
}

export * from './types'
export * from './engine/RhythmMetronomeEngine'
export * from './components/RhythmMetronomeMasterView'
export * from './components/RhythmMetronomeDrawer'
