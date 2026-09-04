import { useState, useEffect, useMemo, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import { EmotionCurveEngine } from '../engine/EmotionCurveEngine'
import type { ChapterEmotionEvaluation } from '../types'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import { indexedDbEmotionAuditRepository } from '../../../adapters/indexedDbEmotionAuditRepository'
import { clock } from '../../../adapters/clock'
import { idGenerator } from '../../../adapters/idGenerator'
import { Activity, AlertTriangle, BookmarkCheck, RefreshCw } from 'lucide-react'

export const EmotionCurveMasterView: FC<DesktopPluginViewProps> = ({ projectId }) => {
  const [chapters, setChapters] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null)

  const loadChapters = async () => {
    setLoading(true)
    try {
      const all = await indexedDbProjectRepository.getChaptersByProject(projectId)
      all.sort((a, b) => a.order - b.order)
      setChapters(all)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadChapters()
  }, [projectId])

  const evaluations: ChapterEmotionEvaluation[] = useMemo(() => {
    return chapters.map((c) =>
      EmotionCurveEngine.evaluateChapter({
        chapterId: c.id,
        chapterTitle: c.title,
        chapterOrder: c.order,
        content: c.content || '',
      })
    )
  }, [chapters])

  const windowFatigueAlerts = useMemo(() => {
    return EmotionCurveEngine.analyzeWindowFatigue(evaluations)
  }, [evaluations])

  const handleSaveSnapshot = async (ev: ChapterEmotionEvaluation) => {
    await indexedDbEmotionAuditRepository.save({
      id: idGenerator.generate('ea'),
      projectId,
      chapterId: ev.chapterId,
      chapterTitle: ev.chapterTitle,
      chapterOrder: ev.chapterOrder,
      wordCount: ev.wordCount,
      vector: ev.vector,
      netPolarity: ev.netPolarity,
      dominantEmotion: ev.dominantEmotion,
      resonanceScore: ev.resonanceScore,
      warnings: ev.warnings,
      suggestions: ev.suggestions,
      updatedAt: clock.now(),
    })
    setSavedSuccessMsg(`已保存第 ${ev.chapterOrder} 章情绪快照`)
    setTimeout(() => setSavedSuccessMsg(null), 2500)
  }

  return (
    <div className="p-6 h-full flex flex-col space-y-4 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 overflow-y-auto">
      <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <Activity className="w-6 h-6 text-rose-500" />
            读者情绪心电图与心智共鸣计 (Emotion Curve)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            双极六维情绪心电图分析，量化“打压蓄势 vs 爆发释放”张弛起伏，防止连续致郁或审美疲劳。
          </p>
        </div>
        <div className="flex items-center gap-2">
          {savedSuccessMsg && (
            <span className="text-xs text-rose-600 dark:text-rose-400 font-medium">
              {savedSuccessMsg}
            </span>
          )}
          <button
            onClick={loadChapters}
            className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            刷新波浪
          </button>
        </div>
      </div>

      {windowFatigueAlerts.length > 0 && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl space-y-1 text-xs text-rose-700 dark:text-rose-300">
          {windowFatigueAlerts.map((a, idx) => (
            <div key={idx} className="flex items-center gap-2 font-medium">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-500" />
              <span>{a}</span>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-400">正在生成全书情绪心电图谱...</div>
      ) : evaluations.length === 0 ? (
        <div className="text-center py-12 text-slate-400">项目中暂未创建章节。</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {evaluations.map((ev) => (
            <div
              key={ev.chapterId}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:border-rose-400 dark:hover:border-rose-500 transition"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">
                    第 {ev.chapterOrder} 章：{ev.chapterTitle}
                  </span>
                  <span
                    className={`px-2 py-0.5 text-[10px] rounded font-semibold ${
                      ev.netPolarity > 20
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : ev.netPolarity < -20
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {ev.netPolarity > 0 ? `+${ev.netPolarity} 扬升` : `${ev.netPolarity} 蓄势`}
                  </span>
                </div>

                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-2xl font-black text-rose-500">{ev.resonanceScore}</span>
                  <span className="text-xs text-slate-400">共鸣深度 / 100</span>
                  <span className="text-xs text-slate-400 ml-auto">主导：{ev.dominantEmotion}</span>
                </div>

                {/* 六维雷达进度条 */}
                <div className="space-y-1.5 text-[11px] bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 mb-3">
                  <div className="flex items-center justify-between">
                    <span>🔥 爽感释放 (Catharsis)</span>
                    <span className="font-semibold text-amber-600">{ev.vector.catharsis}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>⚡ 悬念期待 (Anticipation)</span>
                    <span className="font-semibold text-blue-600">{ev.vector.anticipation}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>⚔️ 危机紧绷 (Tension)</span>
                    <span className="font-semibold text-purple-600">{ev.vector.tension}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>🌧️ 挫折压抑 (Frustration)</span>
                    <span className="font-semibold text-rose-600">{ev.vector.frustration}</span>
                  </div>
                </div>

                {ev.warnings.length > 0 && (
                  <div className="text-xs text-rose-600 dark:text-rose-400 space-y-1 mb-3">
                    {ev.warnings.map((w, idx) => (
                      <p key={idx}>{w}</p>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  onClick={() => handleSaveSnapshot(ev)}
                  className="px-2.5 py-1 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded flex items-center gap-1 transition"
                >
                  <BookmarkCheck className="w-3.5 h-3.5" />
                  沉淀心电快照
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
