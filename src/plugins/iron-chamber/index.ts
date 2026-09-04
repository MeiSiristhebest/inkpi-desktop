import type { DesktopPlugin } from "../../types/plugin"
import { Lock } from "lucide-react"
import { IronChamberMasterView } from "./components/IronChamberMasterView"
import { IronChamberDrawer } from "./components/IronChamberDrawer"

export const IronChamberPlugin: DesktopPlugin = {
  id: "iron-chamber",
  name: "黑曜石小黑屋锁定器",
  description: "基于心流心理学与不可逆状态机，字数与倒计时契约绑定，全屏强制切断干扰",
  version: "1.0.0",
  author: "InkPi Core Team",
  category: "flow",
  tags: ["小黑屋", "心流", "防拖延", "不可逆锁定"],
  enabledByDefault: true,
  icon: Lock,
  mainView: IronChamberMasterView,
  drawerSnippetView: IronChamberDrawer,
}

export * from "./types"
export * from "./engine/IronChamberEngine"
export * from "./components/IronChamberMasterView"
export * from "./components/IronChamberDrawer"
