import type { FC } from "react"
import type { DesktopPluginDrawerProps } from "../../../types/plugin"
import { GitFork } from "lucide-react"

export const MultiverseDrawer: FC<DesktopPluginDrawerProps> = () => {
  return (
    <div className="p-3 space-y-3 text-xs">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <span className="font-bold flex items-center gap-1.5 text-purple-500">
          <GitFork className="w-4 h-4" /> 平行时空沙盒
        </span>
        <span className="text-purple-600 dark:text-purple-400 font-bold">主宇宙 (Canon)</span>
      </div>

      <div className="p-2.5 rounded bg-slate-100 dark:bg-slate-800 space-y-1.5 text-[11px]">
        <div className="flex justify-between">
          <span className="text-slate-500">当前时间线状态:</span>
          <span className="font-bold text-slate-700 dark:text-slate-300">因果收敛中</span>
        </div>
        <div className="text-[10px] text-slate-500">
          提示：可在主视口创建“What-If”分歧奇点，推演不救女配或错失机缘的支线演化。
        </div>
      </div>
    </div>
  )
}

