import type { DesktopPlugin } from "../../types/plugin"
import { ShieldAlert } from "lucide-react"
import { PovGuardMasterView } from "./components/PovGuardMasterView"
import { PovGuardDrawer } from "./components/PovGuardDrawer"

export const PovGuardPlugin: DesktopPlugin = {
  id: "pov-guard",
  name: "POV心智防火墙",
  description: "基于心智理论与模态认知域，实时监控并阻断跳视角(Head-Hopping)与全知视角情报泄漏",
  version: "1.0.0",
  author: "InkPi Core Team",
  category: "review",
  tags: ["POV", "心智理论", "视角控制", "全知泄漏"],
  enabledByDefault: true,
  icon: ShieldAlert,
  mainView: PovGuardMasterView,
  drawerSnippetView: PovGuardDrawer,
}

export * from "./types"
export * from "./engine/PovGuardEngine"
export * from "./components/PovGuardMasterView"
export * from "./components/PovGuardDrawer"
