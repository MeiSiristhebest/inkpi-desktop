// dialogue-distiller 插件主入口

import type { DesktopPlugin } from '../../types/plugin'
import { DialogueDistillerMasterView } from './components/DialogueDistillerMasterView'
import { DialogueDistillerDrawer } from './components/DialogueDistillerDrawer'
import { Mic } from 'lucide-react'

export const DialogueDistillerPlugin: DesktopPlugin = {
  id: 'dialogue-distiller',
  name: '角色对白声纹',
  description: '言语风格测度学（Stylometry）、余弦相似度声纹比对与群像“千人一面”去同质化',
  version: '1.0.0',
  author: 'InkPi Core Team',
  category: 'craft',
  tags: ['对白', '声纹', '群像', '句长', '同质化', '语言风格'],
  enabledByDefault: true,
  icon: Mic,
  mainView: DialogueDistillerMasterView,
  drawerSnippetView: DialogueDistillerDrawer,
}

export * from './types'
export * from './engine/DialogueDistillerEngine'
export * from './components/DialogueDistillerMasterView'
export * from './components/DialogueDistillerDrawer'
