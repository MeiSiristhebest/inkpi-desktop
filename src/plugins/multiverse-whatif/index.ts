import type { DesktopPlugin } from "../../types/plugin"
import { GitFork } from "lucide-react"
import { MultiverseMasterView } from "./components/MultiverseMasterView"
import { MultiverseDrawer } from "./components/MultiverseDrawer"

export const MultiverseWhatIfPlugin: DesktopPlugin = {
  id: "multiverse-whatif",
  name: "平行宇宙因果沙盒推演器",
  description: "基于因果树拓扑分歧，并行推演剧情分支与蝴蝶效应演化",
  version: "1.0.0",
  author: "InkPi Core Team",
  category: "plot",
  tags: ["平行宇宙", "因果沙盒", "What-If", "蝴蝶效应"],
  enabledByDefault: true,
  icon: GitFork,
  mainView: MultiverseMasterView,
  drawerSnippetView: MultiverseDrawer,
}

export * from "./types"
export * from "./engine/MultiverseEngine"
export * from "./components/MultiverseMasterView"
export * from "./components/MultiverseDrawer"

