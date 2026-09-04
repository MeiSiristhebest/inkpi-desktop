import type { DesktopPlugin } from "../../types/plugin"
import { GitCompare } from "lucide-react"
import { DiffReviewerMasterView } from "./components/DiffReviewerMasterView"
import { DiffReviewerDrawer } from "./components/DiffReviewerDrawer"

export const DiffReviewerPlugin: DesktopPlugin = {
  id: "diff-reviewer",
  name: "双栏审校与合稿器",
  description: "基于 Myers SES 最短编辑算法与行内字词级对齐，实现多源修订的分块采纳与原子合稿",
  version: "1.0.0",
  author: "InkPi Core Team",
  category: "review",
  tags: ["Diff", "双栏审校", "Plan/Apply", "Myers算法", "合稿"],
  enabledByDefault: true,
  icon: GitCompare,
  mainView: DiffReviewerMasterView,
  drawerSnippetView: DiffReviewerDrawer,
}

export * from "./types"
export * from "./engine/DiffReviewerEngine"
export * from "./components/DiffReviewerMasterView"
export * from "./components/DiffReviewerDrawer"
