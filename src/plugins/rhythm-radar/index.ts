import type { DesktopPlugin } from "../../types/plugin"
import { Activity } from "lucide-react"
import { RhythmRadarMasterView } from "./components/RhythmRadarMasterView"
import { RhythmRadarDrawer } from "./components/RhythmRadarDrawer"

export const RhythmRadarPlugin: DesktopPlugin = {
  id: "rhythm-radar",
  name: "剧情节奏与断章雷达",
  description: "测算全卷张力曲线识别平淡水文，智能推荐生死/反转/高潮/颠覆 4 大黄金断章切口",
  version: "1.0.0",
  author: "InkPi Core Team",
  category: "rhythm",
  tags: ["断章雷达", "张力曲线", "剧情节奏", "网文爆点"],
  enabledByDefault: true,
  icon: Activity,
  mainView: RhythmRadarMasterView,
  drawerSnippetView: RhythmRadarDrawer,
}

export * from "./types"
export * from "./engine/RhythmRadarEngine"
export * from "./components/RhythmRadarMasterView"
export * from "./components/RhythmRadarDrawer"
