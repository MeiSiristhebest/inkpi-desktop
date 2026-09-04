import { useState, useEffect, type FC } from "react"
import type { DesktopPluginDrawerProps } from "../../../types/plugin"
import { indexedDbScrapbookRepository } from "../../../adapters/indexedDbScrapbookRepository"
import { ScrapbookEngine } from "../engine/ScrapbookEngine"
import type { ScrapbookFragmentRecord, ScrapRecommendation } from "../types"
import { Archive, Sparkles } from "lucide-react"

export const ScrapbookDrawer: FC<DesktopPluginDrawerProps> = ({ projectId, currentText }) => {
  const [fragments, setFragments] = useState<ScrapbookFragmentRecord[]>([])
  const [recs, setRecs] = useState<ScrapRecommendation[]>([])

  useEffect(() => {
    indexedDbScrapbookRepository.getAll(projectId).then((all) => {
      setFragments(all)
    }).catch(console.error)
  }, [projectId])

  useEffect(() => {
    if (!currentText || fragments.length === 0) {
      setRecs([])
      return
    }
    const result = ScrapbookEngine.recommendFragments(currentText, fragments, 3)
    setRecs(result)
  }, [currentText, fragments])

  return (
    <div className="p-3 space-y-3 text-xs">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <span className="font-bold flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
          <Archive className="w-4 h-4" /> 废稿灵感推荐
        </span>
        <span className="text-[10px] text-slate-400">
          池内 {fragments.length} 条
        </span>
      </div>

      {recs.length === 0 ? (
        <div className="p-3 rounded bg-slate-50 dark:bg-slate-800/50 text-slate-400 text-center">
          未检索到与当前上下文契合的废稿
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>智能语义召回灵感:</span>
          </div>

          {recs.map((r) => (
            <div
              key={r.fragment.id}
              className="p-2.5 rounded-lg border bg-white dark:bg-slate-800 border-indigo-200 dark:border-indigo-900/60 space-y-1"
            >
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span className="font-bold text-indigo-600">
                  契合度: {Math.round(r.similarityScore * 100)}%
                </span>
                <span>{r.fragment.wordCount} 字</span>
              </div>
              <div className="font-serif text-[11px] text-slate-600 dark:text-slate-300 line-clamp-3">
                "{r.fragment.snippet}"
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
