import type { DesktopPlugin } from "../../types/plugin"
import { Headphones } from "lucide-react"
import { SoundscapeMasterView } from "./components/SoundscapeMasterView"
import { SoundscapeDrawer } from "./components/SoundscapeDrawer"

export const SoundscapePlugin: DesktopPlugin = {
  id: "soundscape",
  name: "机械键盘声学与白噪音伴奏",
  description: "纯物理声学建模合成，实时模拟青轴/茶轴/打字机微扰击键音，并伴奏沉浸式白噪音",
  version: "1.0.0",
  author: "InkPi Core Team",
  category: "craft",
  tags: ["键盘声效", "白噪音", "WebAudio", "心流伴奏"],
  enabledByDefault: true,
  icon: Headphones,
  mainView: SoundscapeMasterView,
  drawerSnippetView: SoundscapeDrawer,
}

export * from "./types"
export * from "./engine/AudioSynthesizerEngine"
export * from "./components/SoundscapeMasterView"
export * from "./components/SoundscapeDrawer"
