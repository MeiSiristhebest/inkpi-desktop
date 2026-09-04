import type { DesktopPlugin } from "../../types/plugin"
import { MessageSquare } from "lucide-react"
import { ShadowReaderMasterView } from "./components/ShadowReaderMasterView"
import { ShadowReaderDrawer } from "./components/ShadowReaderDrawer"

export const ShadowReaderPlugin: DesktopPlugin = {
  id: "shadow-reader",
  name: "读者弹幕与毒点预判模拟器",
  description: "5类网文读者认知肖像拟真弹幕模拟与送女/圣母/憋屈毒点高危预警",
  version: "1.0.0",
  author: "InkPi Core Team",
  category: "flow",
  tags: ["读者模拟", "弹幕推演", "毒点排查", "商业网文"],
  enabledByDefault: true,
  icon: MessageSquare,
  mainView: ShadowReaderMasterView,
  drawerSnippetView: ShadowReaderDrawer,
}

export * from "./types"
export * from "./engine/ShadowReaderEngine"
export * from "./components/ShadowReaderMasterView"
export * from "./components/ShadowReaderDrawer"

