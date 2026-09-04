import type { DesktopPlugin } from '../../types/plugin'
import { Activity } from 'lucide-react'
import { EmotionCurveMasterView } from './components/EmotionCurveMasterView'
import { EmotionCurveDrawer } from './components/EmotionCurveDrawer'

export const EmotionCurvePlugin: DesktopPlugin = {
  id: 'emotion-curve',
  name: '读者情绪心电图',
  description: '双极六维情绪心电波浪图、爽点释放与憋屈蓄势张弛比疲劳预警',
  version: '1.0.0',
  author: 'InkPi Core Team',
  category: 'rhythm',
  tags: ['情绪', '心电图', '爽点', '代入感', '抑扬比', '连载疲劳'],
  enabledByDefault: true,
  icon: Activity,
  mainView: EmotionCurveMasterView,
  drawerSnippetView: EmotionCurveDrawer,
}

export * from './types'
export * from './engine/EmotionCurveEngine'
export * from './components/EmotionCurveMasterView'
export * from './components/EmotionCurveDrawer'
