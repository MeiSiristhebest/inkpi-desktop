import type { DesktopPlugin } from '../../types/plugin'
import { Lightbulb } from 'lucide-react'
import { BrainstormSparkMasterView } from './components/BrainstormSparkMasterView'
import { BrainstormSparkDrawer } from './components/BrainstormSparkDrawer'

export const BrainstormSparkPlugin: DesktopPlugin = {
  id: 'brainstorm-spark',
  name: '灵感火花破局炉',
  description: '八大逆向思维算子、故事矛盾矩阵与卡文绝境反转推演',
  version: '1.0.0',
  author: 'InkPi Core Team',
  category: 'flow',
  tags: ['灵感', '卡文', '反转', '破局', '算子', '脑洞'],
  enabledByDefault: true,
  icon: Lightbulb,
  mainView: BrainstormSparkMasterView,
  drawerSnippetView: BrainstormSparkDrawer,
}

export * from './types'
export { ArchetypeEngine } from '../archetype-cards/engine/ArchetypeEngine'
export type {
  ChemistryResult,
  ArchetypeCategory,
  NarrativeArchetypeRecord,
} from '../archetype-cards/types'
export * from './engine/BrainstormSparkEngine'
export * from './components/BrainstormSparkMasterView'
export * from './components/BrainstormSparkDrawer'
