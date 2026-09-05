// living-codex 插件主入口

import type { DesktopPlugin } from '../../types/plugin'
import { CodexMasterView } from './components/CodexMasterView'
import { CodexWriterDrawer } from './components/CodexWriterDrawer'
import { indexedDbCodexEntityRepository } from '../../adapters/indexedDbCodexEntityRepository'
import { CodexGraphStore } from './engine/GraphStore'
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
  aiCapabilities: {
    systemPromptEnhancer: async (projectId: string, currentText: string): Promise<string> => {
      try {
        const allEntities = await indexedDbCodexEntityRepository.getAll()
        const projectEntities = allEntities.filter((e) => e.projectId === projectId)
        if (projectEntities.length === 0) return ''

        const store = new CodexGraphStore()
        store.updateDataset(projectEntities)
        const { matchedEntities } = store.resolveContextSlice(currentText, 1000)

        if (matchedEntities.length === 0) return ''

        const entitySnippets = matchedEntities
          .map(
            (e) =>
              `【${e.name}】(${e.category}): ${e.summary || (e.attributes ? JSON.stringify(e.attributes) : '无详细设定')}`,
          )
          .join('\n')

        return `\n### 活体世界观实体设定注入\n当前章节涉及以下世界观实体，续写与交互请严格遵循其设定：\n${entitySnippets}\n`
      } catch (err) {
        console.warn('[LivingCodexPlugin] Failed to enhance system prompt:', err)
        return ''
      }
    },
  },
}

export * from './types'
export { MemoryPalaceEngine } from '../memory-palace/engine/MemoryPalaceEngine'
export type { EntitySearchResult } from '../memory-palace/types'
export * from './engine/AcAutomaton'
export * from './engine/GraphStore'
export * from './engine/Adapters'
export * from './components/CodexMasterView'
export * from './components/CodexWriterDrawer'
export * from './components/CodexEntityEditor'
