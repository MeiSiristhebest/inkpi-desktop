// living-codex 插件主入口

import type { DesktopPlugin } from '../../types/plugin'
import { CodexMasterView } from './components/CodexMasterView'
import { CodexWriterDrawer } from './components/CodexWriterDrawer'
import { Layers } from 'lucide-react'

export const LivingCodexPlugin: DesktopPlugin = {
  id: 'living-codex',
  name: '活体世界观',
  description: '8大世界观实体图谱管理与 Aho-Corasick 正文实时扫描感知',
  version: '1.0.0',
  author: 'InkPi Core Team',
  category: 'lore',
  tags: ['世界书', '实体图谱', 'AC扫描', '智能提示'],
  enabledByDefault: true,
  icon: Layers,
  mainView: CodexMasterView,
  drawerSnippetView: CodexWriterDrawer,
}

export * from './types'
export * from './engine/AcAutomaton'
export * from './engine/GraphStore'
export * from './engine/Adapters'
export * from './components/CodexMasterView'
export * from './components/CodexWriterDrawer'
export * from './components/CodexEntityEditor'
