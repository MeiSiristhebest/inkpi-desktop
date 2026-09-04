import { useState, useEffect, type FC } from "react"
import type { DesktopPluginDrawerProps } from "../../../types/plugin"
import { indexedDbIronChamberRepository } from "../../../adapters/indexedDbIronChamberRepository"
import { IronChamberEngine } from "../engine/IronChamberEngine"
import type { IronChamberRecord } from "../types"
import { Lock } from "lucide-react"
import { clock } from "../../../adapters/clock"

export const IronChamberDrawer: FC<DesktopPluginDrawerProps> = ({ projectId, currentText }) => {
  const [activeRecord, setActiveRecord] = useState<IronChamberRecord | null>(null)

  useEffect(() => {
    indexedDbIronChamberRepository.getActive(projectId).then((rec) => {
      setActiveRecord(rec || null)
    }).catch(console.error)
  }, [projectId])

  const progress = activeRecord
    ? IronChamberEngine.calculateProgress(activeRecord, currentText.length, clock.now())
    : null

  return (
    <div className="p-3 space-y-3 text-xs">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <span className="font-bold flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
          <Lock className="w-4 h-4" /> 小黑屋心流守卫
        </span>
        {activeRecord && (
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-100 dark:bg-rose-950 text-rose-600 font-bold">
            LOCKED
          </span>
        )}
      </div>

      {!activeRecord ? (
        <div className="p-3 rounded bg-slate-50 dark:bg-slate-800/50 text-slate-400 text-center">
          当前未启动小黑屋心流契约
        </div>
      ) : (
        <div className="space-y-2">
          {progress && (
            <div className="p-2 rounded bg-slate-900 text-slate-100 space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">目标字数:</span>
                <span className="font-bold text-indigo-400">
                  {progress.deltaWords} / {progress.targetWords}
                </span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-indigo-500 h-full" style={{ width: `${progress.wordsPercentage}%` }} />
              </div>

              <div className="flex justify-between text-[11px] pt-1">
                <span className="text-slate-400">倒计时:</span>
                <span className="font-bold text-amber-400">
                  {Math.floor(progress.elapsedSeconds / 60)} / {activeRecord.targetMinutes} 分
                </span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-amber-500 h-full" style={{ width: `${progress.timePercentage}%` }} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
