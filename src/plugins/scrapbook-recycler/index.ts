import type { DesktopPlugin } from "../../types/plugin"
import { Archive } from "lucide-react"
import { ScrapbookMasterView } from "./components/ScrapbookMasterView"
import { ScrapbookDrawer } from "./components/ScrapbookDrawer"

export const ScrapbookRecyclerPlugin: DesktopPlugin = {
  id: "scrapbook-recycler",
  name: "废稿灵感碎纸机回收站",
  description: "自动捕获删改文本碎片消除删减焦虑，基于 TF-IDF 倒排与余弦相似度在卡文时一键还魂复用",
  version: "1.0.0",
  author: "InkPi Core Team",
  category: "flow",
  tags: ["废稿回收", "碎纸机", "TF-IDF", "灵感召回", "心流保护"],
  enabledByDefault: true,
  icon: Archive,
  mainView: ScrapbookMasterView,
  drawerSnippetView: ScrapbookDrawer,
}

export * from "./types"
export * from "./engine/ScrapbookEngine"
export * from "./components/ScrapbookMasterView"
export * from "./components/ScrapbookDrawer"
