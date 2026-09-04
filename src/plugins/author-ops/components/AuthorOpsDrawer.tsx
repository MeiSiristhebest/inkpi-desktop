import type { FC } from "react"
import type { DesktopPluginDrawerProps } from "../../../types/plugin"
import { TrendingUp } from "lucide-react"

export const AuthorOpsDrawer: FC<DesktopPluginDrawerProps> = () => {
  return (
    <div className="p-3 space-y-3 text-xs">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <span className="font-bold flex items-center gap-1.5 text-blue-500">
          <TrendingUp className="w-4 h-4" /> 连载追读哨兵
        </span>
        <span className="text-emerald-500 font-bold">留存健康</span>
      </div>

      <div className="p-2.5 rounded bg-slate-100 dark:bg-slate-800 space-y-1.5 text-[11px]">
        <div className="flex justify-between">
          <span className="text-slate-500">最近留存变化:</span>
          <span className="font-bold text-slate-700 dark:text-slate-300">-2.3% (正常浮动)</span>
        </div>
        <div className="text-[10px] text-slate-500">
          建议：主线平稳推进中，警惕单章跌幅超12%断崖点。
        </div>
      </div>
    </div>
  )
}

