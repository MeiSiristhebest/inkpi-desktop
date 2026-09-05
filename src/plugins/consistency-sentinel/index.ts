// consistency-sentinel 插件主入口

import type { DesktopPlugin } from '../../types/plugin'
import { ConsistencyMasterView } from './components/ConsistencyMasterView'
import { ConsistencyDrawer } from './components/ConsistencyDrawer'
import { indexedDbPowerTierRepository } from '../../adapters/indexedDbPowerTierRepository'
import { consistencyEngine } from './engine/ConsistencyEngine'
import { ShieldAlert } from 'lucide-react'

export const ConsistencySentinelPlugin: DesktopPlugin = {
  id: 'consistency-sentinel',
  name: '设定哨兵',
  description: '战力阶梯偏序有向图、越阶杀敌失真与死者复生等设定吃书巡检',
  version: '1.0.0',
  author: 'InkPi Core Team',
  category: 'review',
  tags: ['战力', '设定自洽', '吃书', '死者复生', '逻辑审查'],
  enabledByDefault: true,
  icon: ShieldAlert,
  mainView: ConsistencyMasterView,
  drawerSnippetView: ConsistencyDrawer,
  aiCapabilities: {
    systemPromptEnhancer: async (projectId: string): Promise<string> => {
      try {
        const sys = await indexedDbPowerTierRepository.get(projectId)
        const currentSys = sys || consistencyEngine.getDefaultSystem()
        const tierLadder = currentSys.tiers.join(' < ')
        return `\n### 设定自洽与战力阶梯规则\n本项目设定的严禁倒错战力天梯偏序为：\n${tierLadder}\n严禁在未付出足额对等代偿（至宝反噬、禁术透支、天劫大阵等）的情况下发生违背偏序的越阶击杀，死者不可无故复生。\n`
      } catch (err) {
        console.warn('[ConsistencySentinelPlugin] Failed to enhance prompt:', err)
        return ''
      }
    },
  },
}

export * from './types'
export * from './engine/ConsistencyEngine'
export * from './components/ConsistencyMasterView'
export * from './components/ConsistencyDrawer'
