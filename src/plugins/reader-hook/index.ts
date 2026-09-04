// reader-hook 插件主入口

import type { DesktopPlugin } from '../../types/plugin'
import { ReaderHookMasterView } from './components/ReaderHookMasterView'
import { ReaderHookDrawer } from './components/ReaderHookDrawer'
import { Anchor } from 'lucide-react'

export const ReaderHookPlugin: DesktopPlugin = {
  id: 'reader-hook',
  name: '断章钩子工坊',
  description: '章尾 300 字悬念张力诊断、Zeigarnik 未完成效应与 6 大工业化断章范式',
  version: '1.0.0',
  author: 'InkPi Core Team',
  category: 'rhythm',
  tags: ['断章', '钩子', '追更率', '悬念', 'CTI张力'],
  enabledByDefault: true,
  icon: Anchor,
  mainView: ReaderHookMasterView,
  drawerSnippetView: ReaderHookDrawer,
}

export * from './types'
export * from './engine/ReaderHookEngine'
export * from './components/ReaderHookMasterView'
export * from './components/ReaderHookDrawer'
