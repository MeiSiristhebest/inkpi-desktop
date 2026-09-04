import type { DesktopPlugin } from "../../types/plugin"
import { CheckCircle2 } from "lucide-react"
import { NarrativeLinterMasterView } from "./components/NarrativeLinterMasterView"
import { NarrativeLinterDrawer } from "./components/NarrativeLinterDrawer"

export const NarrativeLinterPlugin: DesktopPlugin = {
  id: "narrative-linter",
  name: "360+文学质量与人设门禁",
  description: "工业级网文质量与人设规则管线，实时排查副词堆叠、窒息长句、违和倒灌设定与现代出戏梗",
  version: "1.0.0",
  author: "InkPi Core Team",
  category: "review",
  tags: ["门禁", "文学质量", "人设校验", "QuickFix"],
  enabledByDefault: true,
  icon: CheckCircle2,
  mainView: NarrativeLinterMasterView,
  drawerSnippetView: NarrativeLinterDrawer,
}

export * from "./types"
export * from "./engine/NarrativeLinterEngine"
export * from "./components/NarrativeLinterMasterView"
export * from "./components/NarrativeLinterDrawer"
