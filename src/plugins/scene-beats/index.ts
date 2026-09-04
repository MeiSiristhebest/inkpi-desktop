// scene-beats 插件主入口

import type { DesktopPlugin } from '../../types/plugin'
import { SceneBeatsMasterView } from './components/SceneBeatsMasterView'
import { SceneBeatsDrawer } from './components/SceneBeatsDrawer'
import { ListChecks } from 'lucide-react'

export const SceneBeatsPlugin: DesktopPlugin = {
  id: 'scene-beats',
  name: '细纲节拍',
  description: '单章微观细纲戏剧弧、字数预算映射与 Save the Cat 节拍导演器',
  version: '1.0.0',
  author: 'InkPi Core Team',
  category: 'plot',
  tags: ['细纲', '节拍器', '起承转合', '戏剧弧', '单章导演'],
  enabledByDefault: true,
  icon: ListChecks,
  mainView: SceneBeatsMasterView,
  drawerSnippetView: SceneBeatsDrawer,
}

export * from './types'
export * from './engine/SceneBeatsEngine'
export * from './components/SceneBeatsMasterView'
export * from './components/SceneBeatsDrawer'
