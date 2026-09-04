import type { FC } from "react"
import type { DesktopPluginDrawerProps } from "../../../types/plugin"
import { RhythmRadarEngine } from "../engine/RhythmRadarEngine"
import { Activity } from "lucide-react"

export const RhythmRadarDrawer: FC<DesktopPluginDrawerProps> = ({ currentText }) => {
  const analysis = RhythmRadarEngine.analyzeChapter(currentText, "cur", 1)

  return (
    <div className="p-3 space-y-3 text-xs">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <span className="font-bold flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
          <Activity className="w-4 h-4" /> 断章张力雷达
        </span>
        <span className="text-[10px] text-indigo-500 font-bold">
          张力: {Math.round(analysis.tensionScore * 100)}%
        </span>
      </div>

      <div className="p-2.5 rounded bg-slate-100 dark:bg-slate-800 space-y-1.5">
        <div className="flex justify-between text-[11px]">
          <span className="text-slate-500">建议断章模式:</span>
          <span className="font-bold text-amber-600 dark:text-amber-400">
            {analysis.cliffhanger.type.toUpperCase()}
          </span>
        </div>
        <div className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2">
          {analysis.cliffhanger.hookPrompt}
        </div>
      </div>
    </div>
  )
}
