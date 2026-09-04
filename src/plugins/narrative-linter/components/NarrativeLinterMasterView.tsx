import { useState, useEffect, type FC } from "react"
import type { DesktopPluginViewProps } from "../../../types/plugin"
import { NarrativeLinterEngine } from "../engine/NarrativeLinterEngine"
import type { LintIssue } from "../types"
import { CheckCircle2, AlertCircle, Wrench } from "lucide-react"
import { clock } from "../../../adapters/clock"

export const NarrativeLinterMasterView: FC<DesktopPluginViewProps> = ({ onStats }) => {
  const [engine] = useState(() => new NarrativeLinterEngine())
  const [rules, setRules] = useState(() => NarrativeLinterEngine.getDefaultRules())
  const [text, setText] = useState("")
  const [issues, setIssues] = useState<LintIssue[]>([])
  const [cleanScore, setCleanScore] = useState(100)

  useEffect(() => {
    onStats?.({
      title: "360+文学质量与人设门禁",
      wordCount: text.length,
      updatedAt: clock.now(),
    })
  }, [text, onStats])

  const handleAudit = () => {
    const res = engine.lint(text, rules)
    setIssues(res.issues)
    setCleanScore(res.cleanScore)
  }

  const toggleRule = (ruleId: string) => {
    setRules((prev) =>
      prev.map((r) => (r.ruleId === ruleId ? { ...r, enabled: !r.enabled } : r))
    )
  }

  const applyFix = (issue: LintIssue) => {
    if (!issue.quickFix) return
    const newText = NarrativeLinterEngine.applyQuickFix(text, issue)
    setText(newText)
    const res = engine.lint(newText, rules)
    setIssues(res.issues)
    setCleanScore(res.cleanScore)
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto text-slate-800 dark:text-slate-100">
      <div className="flex items-center justify-between border-b pb-4 border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            <span>360+ 文学质量与人设门禁 (NarrativeLinter)</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            ESLint 风格的网文工业级质量管线，涵盖副词堆叠、窒息长句、百科说教与现代热梗拦截
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-slate-400">文学清洁度评分</div>
            <div className={`text-2xl font-black ${cleanScore >= 80 ? "text-emerald-500" : cleanScore >= 60 ? "text-amber-500" : "text-rose-500"}`}>
              {cleanScore} <span className="text-sm font-normal text-slate-400">/ 100</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="col-span-1 space-y-2 border rounded-lg p-3 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-2">
            门禁规则集 ({rules.filter((r) => r.enabled).length}/{rules.length})
          </h3>
          <div className="space-y-2 text-xs">
            {rules.map((r) => (
              <div
                key={r.ruleId}
                onClick={() => toggleRule(r.ruleId)}
                className={`p-2 rounded cursor-pointer border transition ${
                  r.enabled
                    ? "bg-white dark:bg-slate-800 border-indigo-500 shadow-sm"
                    : "bg-transparent border-slate-300 dark:border-slate-700 opacity-50"
                }`}
              >
                <div className="font-semibold flex items-center justify-between">
                  <span>{r.name}</span>
                  <span className="text-[10px] px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700">
                    {r.severity}
                  </span>
                </div>
                <div className="text-slate-500 mt-1 text-[11px]">{r.description}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-2 space-y-2 flex flex-col">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">待审文本编辑:</label>
          <textarea
            className="w-full h-96 p-3 text-sm border rounded font-serif resize-none bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 leading-relaxed"
            placeholder="粘贴或编写正文，运行扫描以排查修辞与人设门禁缺陷..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-semibold transition"
            onClick={handleAudit}
            disabled={!text.trim()}
          >
            运行文学质量与人设门禁审查
          </button>
        </div>

        <div className="col-span-1 space-y-2 flex flex-col">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">门禁拦截列表:</label>
            <span className="text-xs text-slate-500">共 {issues.length} 处</span>
          </div>
          <div className="h-96 overflow-y-auto border rounded p-2.5 space-y-2 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs">
            {issues.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400">
                暂无违规项，文本符合工业级门禁标准
              </div>
            ) : (
              issues.map((issue) => (
                <div
                  key={issue.id}
                  className={`p-2.5 border rounded space-y-1.5 ${
                    issue.severity === "error"
                      ? "border-rose-400 bg-rose-50/50 dark:bg-rose-950/20"
                      : "border-amber-400 bg-amber-50/50 dark:bg-amber-950/20"
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span className={issue.severity === "error" ? "text-rose-600 flex items-center gap-1" : "text-amber-600 flex items-center gap-1"}>
                      <AlertCircle className="w-3.5 h-3.5" /> [{issue.ruleName}]
                    </span>
                    <span className="text-slate-400 font-normal text-[10px]">L{issue.lineNumber}</span>
                  </div>
                  <div className="font-mono bg-white dark:bg-slate-800 p-1 rounded text-[11px]">
                    "{issue.matchedSnippet}"
                  </div>
                  <div className="text-slate-600 dark:text-slate-400 text-[11px]">{issue.message}</div>
                  {issue.quickFix && (
                    <button
                      onClick={() => applyFix(issue)}
                      className="mt-1 w-full text-center px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium transition text-[11px] flex items-center justify-center gap-1"
                    >
                      <Wrench className="w-3 h-3" /> {issue.quickFix.title}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
