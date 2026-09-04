import { useState, useEffect, type FC } from "react"
import type { DesktopPluginDrawerProps } from "../../../types/plugin"
import { NarrativeLinterEngine } from "../engine/NarrativeLinterEngine"
import type { LintSummary } from "../types"
import { CheckCircle2, AlertCircle } from "lucide-react"

export const NarrativeLinterDrawer: FC<DesktopPluginDrawerProps> = ({ currentText }) => {
  const [engine] = useState(() => new NarrativeLinterEngine())
  const [summary, setSummary] = useState<LintSummary | null>(null)

  useEffect(() => {
    if (!currentText || currentText.trim().length === 0) {
      setSummary(null)
      return
    }
    const res = engine.lint(currentText)
    setSummary(res)
  }, [currentText, engine])

  return (
    <div className="p-3 space-y-3 text-xs">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <span className="font-bold flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
          <CheckCircle2 className="w-4 h-4" /> 文学质量门禁巡检
        </span>
        {summary && (
          <span className={`font-bold ${summary.cleanScore >= 80 ? "text-emerald-500" : summary.cleanScore >= 60 ? "text-amber-500" : "text-rose-500"}`}>
            {summary.cleanScore} 分
          </span>
        )}
      </div>

      {!summary || summary.totalIssues === 0 ? (
        <div className="p-3 rounded bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-center">
          ✓ 文笔流畅无瑕疵，符合360+工业门禁标准
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-[11px]">
            <span>门禁异常: {summary.errorCount} 严重 / {summary.warningCount} 告警</span>
          </div>

          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {summary.issues.map((i) => (
              <div
                key={i.id}
                className="p-2 rounded border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 space-y-1"
              >
                <div className="flex items-center justify-between font-semibold">
                  <span className="text-rose-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> [{i.ruleName}]
                  </span>
                  <span className="text-slate-400 text-[10px]">L{i.lineNumber}</span>
                </div>
                <div className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                  "{i.matchedSnippet}"
                </div>
                <div className="text-slate-500 text-[10px]">{i.message}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
