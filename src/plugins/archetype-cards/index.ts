import type { DesktopPlugin } from "../../types/plugin"
import { Dna } from "lucide-react"
import { ArchetypeMasterView } from "./components/ArchetypeMasterView"
import { ArchetypeDrawer } from "./components/ArchetypeDrawer"

export const ArchetypeCardsPlugin: DesktopPlugin = {
  id: "archetype-cards",
  name: "人格原型素材库与叙事母题卡牌",
  description: "36 经典戏剧人格原型与 12 英雄之旅叙事母题，一键抽取注入对手戏张力",
  version: "1.0.0",
  author: "InkPi Core Team",
  category: "craft",
  tags: ["人格原型", "戏剧张力", "对手戏", "英雄之旅", "抽卡"],
  enabledByDefault: true,
  icon: Dna,
  mainView: ArchetypeMasterView,
  drawerSnippetView: ArchetypeDrawer,
}

export * from "./types"
export * from "./engine/ArchetypeEngine"
export * from "./components/ArchetypeMasterView"
export * from "./components/ArchetypeDrawer"
