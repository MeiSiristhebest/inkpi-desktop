import type { DesktopPlugin } from '../../types/plugin'
import { Printer } from 'lucide-react'
import { PressForgeMasterView } from './components/PressForgeMasterView'
import { PressForgeDrawer } from './components/PressForgeDrawer'

export const PressForgePlugin: DesktopPlugin = {
  id: 'press-forge',
  name: '排版压制与发布工坊',
  description: '工业级 AST 格式规整化、多平台规范适配与敏感词预警导出引擎',
  version: '1.0.0',
  author: 'InkPi Core Team',
  category: 'tools',
  tags: ['排版', '压制', '多平台', '发布', '全角缩进', '敏感词', '出版'],
  enabledByDefault: true,
  icon: Printer,
  mainView: PressForgeMasterView,
  drawerSnippetView: PressForgeDrawer,
}

export * from './types'
export { AuthorOpsEngine } from '../author-ops/engine/AuthorOpsEngine'
export type { AuthorOpsProfileRecord, RetentionDropAnalysis } from '../author-ops/types'
export * from './engine/PressForgeEngine'
export * from './components/PressForgeMasterView'
export * from './components/PressForgeDrawer'
