// promise-ledger 插件主入口

import type { DesktopPlugin } from '../../types/plugin'
import { LedgerMasterView } from './components/LedgerMasterView'
import { LedgerWriterDrawer } from './components/LedgerWriterDrawer'
import { BookmarkCheck } from 'lucide-react'

export const PromiseLedgerPlugin: DesktopPlugin = {
  id: 'promise-ledger',
  name: '伏笔账本',
  description: '3P 契诃夫之枪闭环管理、记忆热度模型与债务红线告警',
  version: '1.0.0',
  author: 'InkPi Core Team',
  category: 'plot',
  tags: ['伏笔', '契诃夫之枪', '债务账本', '填坑提醒'],
  enabledByDefault: true,
  icon: BookmarkCheck,
  mainView: LedgerMasterView,
  drawerSnippetView: LedgerWriterDrawer,
}

export * from './types'
export * from './engine/LedgerEngine'
export * from './components/LedgerMasterView'
export * from './components/LedgerWriterDrawer'
export * from './components/DebtGanttChart'
export * from './components/PromiseEntryEditor'
