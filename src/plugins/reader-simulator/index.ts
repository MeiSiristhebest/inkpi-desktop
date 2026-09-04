import type { DesktopPlugin } from '../../types/plugin'
import { Users } from 'lucide-react'
import { ReaderSimulatorMasterView } from './components/ReaderSimulatorMasterView'
import { ReaderSimulatorDrawer } from './components/ReaderSimulatorDrawer'

export const ReaderSimulatorPlugin: DesktopPlugin = {
  id: 'reader-simulator',
  name: '读者认知镜像与段评预演',
  description: '发书前多维读者心智模拟、四大恶性毒点侦测、弃读率推演与本章说段评预演沙盒',
  version: '1.0.0',
  author: 'InkPi Core Team',
  category: 'review',
  tags: ['读者模拟', '毒点排查', '弃读率', '本章说预演', '商业爽感'],
  enabledByDefault: true,
  icon: Users,
  mainView: ReaderSimulatorMasterView,
  drawerSnippetView: ReaderSimulatorDrawer,
}

export * from './types'
export * from './engine/ReaderSimulatorEngine'
export * from './components/ReaderSimulatorMasterView'
export * from './components/ReaderSimulatorDrawer'
