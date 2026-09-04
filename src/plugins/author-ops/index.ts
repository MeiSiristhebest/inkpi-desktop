import type { DesktopPlugin } from "../../types/plugin"
import { TrendingUp } from "lucide-react"
import { AuthorOpsMasterView } from "./components/AuthorOpsMasterView"
import { AuthorOpsDrawer } from "./components/AuthorOpsDrawer"

export const AuthorOpsPlugin: DesktopPlugin = {
  id: "author-ops",
  name: "连载运营台账与作者商业名片",
  description: "追读流失断崖分析、毒点应对干预方案、作者品牌名片与版权管理",
  version: "1.0.0",
  author: "InkPi Core Team",
  category: "flow",
  tags: ["运营台账", "追读流失", "商业名片", "版权合作"],
  enabledByDefault: true,
  icon: TrendingUp,
  mainView: AuthorOpsMasterView,
  drawerSnippetView: AuthorOpsDrawer,
}

export * from "./types"
export * from "./engine/AuthorOpsEngine"
export * from "./components/AuthorOpsMasterView"
export * from "./components/AuthorOpsDrawer"

