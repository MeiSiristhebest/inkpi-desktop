import type { FC } from "react"
import type { DesktopPluginDrawerProps } from "../../../types/plugin"
import { GoldChaptersEngine } from "../engine/GoldChaptersEngine"
import { Award } from "lucide-react"

export const GoldChaptersDrawer: FC<DesktopPluginDrawerProps> = ({ currentText }) => {
  const res = GoldChaptersEngine.evaluate(currentText)

  return (
    <div className="p-3 space-y-3 text-xs">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <span className="font-bold flex items-center gap-1.5 text-amber-500">
          <Award className="w-4 h-4" /> 黄金三章过稿探针
        </span>
        <span className={`font-bold ${res.isQualified ? "text-emerald-500" : "text-rose-500"}`}>
          {res.score} 分
        </span>
      </div>

      <div className="p-2.5 rounded bg-slate-100 dark:bg-slate-800 space-y-1.5">
        <div className="flex justify-between text-[11px]">
          <span className="text-slate-500">状态:</span>
          <span className={`font-bold ${res.isQualified ? "text-emerald-600" : "text-rose-600"}`}>
            {res.isQualified ? "通过签约及格线" : "存在拒签风险"}
          </span>
        </div>
        <div className="text-[10px] text-slate-500">
          动机: {res.motiveScore} | 金手指: {res.goldFingerScore} | 冲突: {res.conflictScore}
        </div>
      </div>
    </div>
  )
}
