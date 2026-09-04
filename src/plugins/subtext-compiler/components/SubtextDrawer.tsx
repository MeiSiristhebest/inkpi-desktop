import type { FC } from "react"
import type { DesktopPluginDrawerProps } from "../../../types/plugin"
import { SubtextCompilerEngine } from "../engine/SubtextCompilerEngine"
import { MessageSquareQuote, Layers } from "lucide-react"

export const SubtextDrawer: FC<DesktopPluginDrawerProps> = ({ currentText }) => {
  // 从正文中提取首个带引号的台词
  const match = currentText.match(/“([^”]+)”/)
  const sampleSpoken = match ? match[1] : "我从来没有在乎过你。"
  const compiled = SubtextCompilerEngine.compile(sampleSpoken, "当前说话者", "pride")

  return (
    <div className="p-3 space-y-3 text-xs">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <span className="font-bold flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
          <MessageSquareQuote className="w-4 h-4" /> 冰山对白探针
        </span>
        <span className="text-[10px] text-slate-400">三轨透视</span>
      </div>

      <div className="p-2.5 rounded bg-slate-100 dark:bg-slate-800 space-y-2">
        <div className="text-slate-500 text-[10px]">捕获台词: "{sampleSpoken.slice(0, 30)}..."</div>
        <div className="p-2 rounded bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900 space-y-1">
          <div className="text-[10px] font-bold text-indigo-600 flex items-center gap-1">
            <Layers className="w-3 h-3" /> 水下潜台词推测:
          </div>
          <div className="font-serif italic text-slate-600 dark:text-slate-300 text-[11px]">
            "{compiled.subtext}"
          </div>
        </div>
        <div className="text-[10px] text-emerald-600 dark:text-emerald-400">
          建议微动作: {compiled.beatAction}
        </div>
      </div>
    </div>
  )
}
