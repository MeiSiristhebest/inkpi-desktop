import type { DesktopPlugin } from "../../types/plugin"
import { Award } from "lucide-react"
import { GoldChaptersMasterView } from "./components/GoldChaptersMasterView"
import { GoldChaptersDrawer } from "./components/GoldChaptersDrawer"

export const GoldChaptersEvalPlugin: DesktopPlugin = {
  id: "gold-chapters-eval",
  name: "黄金三章与签约过稿诊断器",
  description: "从主角核心动机、核心金手指/筹码、主要矛盾与期待感4大维度进行量化评分与重构建议",
  version: "1.0.0",
  author: "InkPi Core Team",
  category: "review",
  tags: ["黄金三章", "签约诊断", "金手指", "开篇商业化"],
  enabledByDefault: true,
  icon: Award,
  mainView: GoldChaptersMasterView,
  drawerSnippetView: GoldChaptersDrawer,
}

export * from "./types"
export * from "./engine/GoldChaptersEngine"
export * from "./components/GoldChaptersMasterView"
export * from "./components/GoldChaptersDrawer"
