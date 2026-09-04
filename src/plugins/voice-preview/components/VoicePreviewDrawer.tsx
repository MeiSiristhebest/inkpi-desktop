import type { FC } from "react"
import type { DesktopPluginDrawerProps } from "../../../types/plugin"
import { VoicePreviewEngine } from "../engine/VoicePreviewEngine"
import { Volume2 } from "lucide-react"

export const VoicePreviewDrawer: FC<DesktopPluginDrawerProps> = ({ currentText }) => {
  const script = VoicePreviewEngine.extractScript(currentText || "")

  return (
    <div className="p-3 space-y-3 text-xs">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <span className="font-bold flex items-center gap-1.5 text-emerald-500">
          <Volume2 className="w-4 h-4" /> 广播剧对白试听
        </span>
        <span className="font-bold text-slate-700 dark:text-slate-300">
          {script.totalLines} 句对白
        </span>
      </div>

      <div className="p-2.5 rounded bg-slate-100 dark:bg-slate-800 space-y-1.5 text-[11px]">
        <div className="flex justify-between">
          <span className="text-slate-500">登场角色说话人:</span>
          <span className="font-bold text-slate-700 dark:text-slate-300">
            {script.characterSpeakers.length > 0 ? script.characterSpeakers.join("、") : "无对白"}
          </span>
        </div>
        <div className="text-[10px] text-slate-500">
          点击主视口可按角色拟真声线（高通激昂/低通阴鸷）连续播放试听广播剧。
        </div>
      </div>
    </div>
  )
}

