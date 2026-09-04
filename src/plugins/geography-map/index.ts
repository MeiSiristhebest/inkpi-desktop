import type { DesktopPlugin } from '../../types/plugin'
import { Compass } from 'lucide-react'
import { GeographyMapMasterView } from './components/GeographyMapMasterView'
import { GeographyMapDrawer } from './components/GeographyMapDrawer'

export const GeographyMapPlugin: DesktopPlugin = {
  id: 'geography-map',
  name: '物理拓扑网格地图与战局沙盘',
  description: '2D离散拓扑网格画板、行军阻尼时间测算、无飞地拓扑校验与地缘战略图层叠加',
  version: '1.0.0',
  author: 'InkPi Core Team',
  category: 'lore',
  tags: ['拓扑地图', '行军测距', '势力地缘', '2D网格', '战局沙盘'],
  enabledByDefault: true,
  icon: Compass,
  mainView: GeographyMapMasterView,
  drawerSnippetView: GeographyMapDrawer,
}

export * from './types'
export * from './engine/GeoMapEngine'
export * from './components/GeographyMapMasterView'
export * from './components/GeographyMapDrawer'
