import type { FC } from "react"
import type { DesktopPluginDrawerProps } from "../../../types/plugin"
import { ShadowReaderEngine } from "../engine/ShadowReaderEngine"
import { MessageSquare, ShieldAlert } from "lucide-react"

export const ShadowReaderDrawer: FC<DesktopPluginDrawerProps> = ({ currentText }) => {
  const sim = ShadowReaderEngine.simulate(currentText || "", "drawer_ch")

  return (
    <div className="p-3 space-y-3 text-xs">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <span className="font-bold flex items-center gap-1.5 text-indigo-500">
          <MessageSquare className="w-4 h-4" /> 读者弹幕哨兵
        </span>
        {sim.toxicAlertCount > 0 ? (
          <span className="text-rose-500 font-bold flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5" /> {sim.toxicAlertCount} 处毒点
          </span>
        ) : (
          <span className="text-emerald-500 font-bold">毒点安全</span>
        )}
      </div>

      <div className="p-2.5 rounded bg-slate-100 dark:bg-slate-800 space-y-2">
        <div className="flex justify-between text-[11px]">
          <span className="text-slate-500">推演弹幕数:</span>
          <span className="font-bold text-slate-700 dark:text-slate-300">{sim.danmakus.length} 条</span>
        </div>
        <div className="text-[10px] text-slate-500 flex justify-between">
          <span>喝彩: {sim.sentimentSummary.applause}</span>
          <span>疑虑: {sim.sentimentSummary.suspicious}</span>
          <span>暴怒: {sim.sentimentSummary.rage}</span>
        </div>
      </div>
    </div>
  )
}
