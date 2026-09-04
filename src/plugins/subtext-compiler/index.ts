import type { DesktopPlugin } from "../../types/plugin"
import { MessageSquareQuote } from "lucide-react"
import { SubtextMasterView } from "./components/SubtextMasterView"
import { SubtextDrawer } from "./components/SubtextDrawer"

export const SubtextCompilerPlugin: DesktopPlugin = {
  id: "subtext-compiler",
  name: "潜台词与冰山对白双轨编译器",
  description: "基于海明威冰山理论，将白开水对白解耦为表面台词、水下潜台词与微动作三轨立体体系",
  version: "1.0.0",
  author: "InkPi Core Team",
  category: "craft",
  tags: ["潜台词", "冰山理论", "对白重构", "微动作", "戏剧张力"],
  enabledByDefault: true,
  icon: MessageSquareQuote,
  mainView: SubtextMasterView,
  drawerSnippetView: SubtextDrawer,
}

export * from "./types"
export * from "./engine/SubtextCompilerEngine"
export * from "./components/SubtextMasterView"
export * from "./components/SubtextDrawer"
