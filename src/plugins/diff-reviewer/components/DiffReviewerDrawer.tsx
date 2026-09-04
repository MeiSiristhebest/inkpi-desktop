import { useState, useEffect, type FC } from "react"
import type { DesktopPluginDrawerProps } from "../../../types/plugin"
import { DiffReviewerEngine } from "../engine/DiffReviewerEngine"
import type { DiffComputeResult } from "../types"
import { GitCompare } from "lucide-react"

export const DiffReviewerDrawer: FC<DesktopPluginDrawerProps> = ({ currentText }) => {
  const [diffResult, setDiffResult] = useState<DiffComputeResult | null>(null)

  useEffect(() => {
    if (!currentText || currentText.trim().length === 0) {
      setDiffResult(null)
      return
    }
    // 模拟基于原稿与改写草案的快照 Diff
    const proposedDraft = currentText
      .replace(/握/g, "紧握")
      .replace(/说/g, "冷哼道")
    const res = DiffReviewerEngine.computeDiff(currentText, proposedDraft)
    setDiffResult(res)
  }, [currentText])

  return (
    <div className="p-3 space-y-3 text-xs">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <span className="font-bold flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
          <GitCompare className="w-4 h-4" /> 双栏审校随动
        </span>
        {diffResult && (
          <span className="text-[10px] text-slate-400">
            {diffResult.hunks.length} 处修订分块
          </span>
        )}
      </div>

      {!diffResult || diffResult.hunks.length === 0 ? (
        <div className="p-3 rounded bg-slate-50 dark:bg-slate-800 text-slate-400 text-center">
          当前章节无待裁决修改差异
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="p-2 rounded bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
              <div className="text-slate-400 text-[10px]">新增字行</div>
              <div className="text-sm font-bold text-emerald-600">+{diffResult.stats.additions}</div>
            </div>
            <div className="p-2 rounded bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
              <div className="text-slate-400 text-[10px]">删除/替换字行</div>
              <div className="text-sm font-bold text-rose-600">-{diffResult.stats.deletions}</div>
            </div>
          </div>

          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {diffResult.hunks.map((hunk, idx) => (
              <div
                key={hunk.id}
                className="p-2 rounded border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 space-y-1"
              >
                <div className="flex items-center justify-between font-bold text-slate-600 dark:text-slate-300">
                  <span>Hunk #{idx + 1}</span>
                  <span className="text-[10px] text-indigo-500 font-mono">
                    L{hunk.oldStartLine} ➔ L{hunk.newStartLine}
                  </span>
                </div>
                <div className="text-slate-500 text-[10px]">
                  共 {hunk.lineChanges.length} 行对齐变更
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
