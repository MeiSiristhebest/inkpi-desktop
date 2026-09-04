import { useState, useEffect, type FC } from "react"
import type { DesktopPluginDrawerProps } from "../../../types/plugin"
import { indexedDbAftermathRepository } from "../../../adapters/indexedDbAftermathRepository"
import type { AftermathPatchRecord } from "../types"
import { GitPullRequest } from "lucide-react"

export const AftermathDrawer: FC<DesktopPluginDrawerProps> = ({ projectId }) => {
  const [pendingPatches, setPendingPatches] = useState<AftermathPatchRecord[]>([])

  useEffect(() => {
    indexedDbAftermathRepository.getAll(projectId).then((all) => {
      setPendingPatches(all.filter((p) => p.status === "pending"))
    }).catch(console.error)
  }, [projectId])

  return (
    <div className="p-3 space-y-3 text-xs">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <span className="font-bold flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
          <GitPullRequest className="w-4 h-4" /> 设定回写提案
        </span>
        <span className="text-[10px] text-amber-500 font-bold">
          {pendingPatches.length} 待确认
        </span>
      </div>

      {pendingPatches.length === 0 ? (
        <div className="p-3 rounded bg-slate-50 dark:bg-slate-800/50 text-slate-400 text-center">
          当前暂无待回写的世界观设定变更
        </div>
      ) : (
        <div className="space-y-2">
          {pendingPatches.map((p) => (
            <div key={p.id} className="p-2 border rounded bg-white dark:bg-slate-800 space-y-1">
              <div className="font-bold text-slate-700 dark:text-slate-300 flex justify-between">
                <span>{p.entityName}</span>
                <span className="text-emerald-500 font-normal">{p.propertyName}</span>
              </div>
              <div className="text-[11px] text-slate-500">
                {p.beforeValue} ➔ <span className="font-semibold text-emerald-600">{p.afterValue}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
