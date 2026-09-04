import type { DesktopPlugin } from "../../types/plugin"
import { GitPullRequest } from "lucide-react"
import { AftermathMasterView } from "./components/AftermathMasterView"
import { AftermathDrawer } from "./components/AftermathDrawer"

export const AftermathSyncPlugin: DesktopPlugin = {
  id: "aftermath-sync",
  name: "章后桥段设定回写器",
  description: "自动扫描章节完稿中的角色境界突破、宝物易主与人际变迁，生成补丁一键回写世界书",
  version: "1.0.0",
  author: "InkPi Core Team",
  category: "lore",
  tags: ["设定回写", "战力同步", "宝物所有权", "世界书闭环"],
  enabledByDefault: true,
  icon: GitPullRequest,
  mainView: AftermathMasterView,
  drawerSnippetView: AftermathDrawer,
}

export * from "./types"
export * from "./engine/AftermathEngine"
export * from "./components/AftermathMasterView"
export * from "./components/AftermathDrawer"
