import type { FC } from "react"
import type { DesktopPluginDrawerProps } from "../../../types/plugin"
import { StoryboardEngine } from "../engine/StoryboardEngine"
import { Film } from "lucide-react"

export const StoryboardDrawer: FC<DesktopPluginDrawerProps> = ({ currentText }) => {
  const extracted = StoryboardEngine.extractStoryboard("drawer_ch", "当前章节", currentText || "")

  return (
    <div className="p-3 space-y-3 text-xs">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <span className="font-bold flex items-center gap-1.5 text-rose-500">
          <Film className="w-4 h-4" /> 名场面四格分镜
        </span>
        <span className="text-rose-600 dark:text-rose-400 font-bold">4 镜头就绪</span>
      </div>

      <div className="p-2.5 rounded bg-slate-100 dark:bg-slate-800 space-y-1.5 text-[11px]">
        <div className="flex justify-between">
          <span className="text-slate-500">分镜起承转合:</span>
          <span className="font-bold text-slate-700 dark:text-slate-300">
            {extracted.frames.length} 格影视级构图
          </span>
        </div>
        <div className="text-[10px] text-slate-500">
          已自动提炼：远景全景、中景对峙、倾斜特写与广角高潮四格电影画格。
        </div>
      </div>
    </div>
  )
}

