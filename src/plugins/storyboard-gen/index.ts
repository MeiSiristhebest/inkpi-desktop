import type { DesktopPlugin } from "../../types/plugin"
import { Film } from "lucide-react"
import { StoryboardMasterView } from "./components/StoryboardMasterView"
import { StoryboardDrawer } from "./components/StoryboardDrawer"

export const StoryboardGenPlugin: DesktopPlugin = {
  id: "storyboard-gen",
  name: "角色立绘与分镜生成器",
  description: "基于四幕电影语法（全景定场/中景对抗/倾斜特写/冲击远景）自动提炼视觉分镜与提示词资产",
  version: "1.0.0",
  author: "InkPi Core Team",
  category: "craft",
  tags: ["视觉分镜", "电影语法", "名场面", "角色概念", "四格分镜"],
  enabledByDefault: true,
  icon: Film,
  mainView: StoryboardMasterView,
  drawerSnippetView: StoryboardDrawer,
}

export * from "./types"
export * from "./engine/StoryboardEngine"
export * from "./components/StoryboardMasterView"
export * from "./components/StoryboardDrawer"

