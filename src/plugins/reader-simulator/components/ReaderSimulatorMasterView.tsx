import { useState, useEffect, useMemo, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import { ReaderSimulatorEngine } from '../engine/ReaderSimulatorEngine'
import type { ChapterSimulationResult } from '../types'
import { indexedDbReaderSimulationRepository } from '../../../adapters/indexedDbReaderSimulationRepository'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import { clock } from '../../../adapters/clock'
import { idGenerator } from '../../../adapters/idGenerator'
import { Users, AlertTriangle, MessageSquare, ShieldAlert, BookmarkCheck, RefreshCw } from 'lucide-react'

export const ReaderSimulatorMasterView: FC<DesktopPluginViewProps> = ({ projectId }) => {
  const [chapters, setChapters] = useState<any[]>([])
  const [selectedChapterId, setSelectedChapterId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null)

  const loadChapters = async () => {
    setLoading(true)
    try {
      const all = await indexedDbProjectRepository.getChaptersByProject(projectId)
      all.sort((a, b) => a.order - b.order)
      setChapters(all)
      if (all.length > 0 && !selectedChapterId) {
        setSelectedChapterId(all[0].id)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadChapters()
  }, [projectId])

  const currentChapter = chapters.find((c) => c.id === selectedChapterId)

  const simulation: ChapterSimulationResult | null = useMemo(() => {
    if (!currentChapter) return null
    return ReaderSimulatorEngine.simulateChapter({
      chapterId: currentChapter.id,
      chapterTitle: currentChapter.title,
      chapterOrder: currentChapter.order,
      content: currentChapter.content || '',
    })
  }, [currentChapter])

  const handleSaveSimulation = async () => {
    if (!simulation) return
    await indexedDbReaderSimulationRepository.save({
      id: idGenerator.generate('rsim'),
      projectId,
      chapterId: simulation.chapterId,
      chapterTitle: simulation.chapterTitle,
      chapterOrder: simulation.chapterOrder,
      toxicityScore: simulation.toxicityScore,
      logicScore: simulation.logicScore,
      pleasureScore: simulation.pleasureScore,
      comments: simulation.comments,
      toxicAlerts: simulation.toxicAlerts,
      suggestions: simulation.suggestions,
      updatedAt: clock.now(),
    })
    setSavedSuccessMsg('已保存当前章读者镜像沙盘评估')
    setTimeout(() => setSavedSuccessMsg(null), 2500)
  }

  return (
    <div className="p-6 h-full flex flex-col space-y-4 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 overflow-y-auto">
      {/* 头部标题与控制区 */}
      <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <Users className="w-6 h-6 text-emerald-600" />
            读者认知镜像与段评预演沙盒 (Reader Simulator)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            四大心智原形预演本章发布后的真实段评、防踩毒防暴毙、逻辑抓虫与防杠审查。
          </p>
        </div>
        <div className="flex items-center gap-2">
          {savedSuccessMsg && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              {savedSuccessMsg}
            </span>
          )}
          <button
            onClick={handleSaveSimulation}
            className="px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition flex items-center gap-1 shadow-sm"
          >
            <BookmarkCheck className="w-3.5 h-3.5" />
            保存评估
          </button>
          <button
            onClick={loadChapters}
            className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            重新推演
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">正在生成读者心智镜像...</div>
      ) : chapters.length === 0 ? (
        <div className="text-center py-12 text-slate-400">项目中暂无章节。</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
          {/* 左侧：章节选择与三维评分 */}
          <div className="space-y-4 lg:col-span-1 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                选择待预演章节：
              </label>
              <select
                value={selectedChapterId}
                onChange={(e) => setSelectedChapterId(e.target.value)}
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
              >
                {chapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    第 {c.order} 章：{c.title}
                  </option>
                ))}
              </select>
            </div>

            {simulation && (
              <>
                <div className="space-y-3 pt-2">
                  <div className="p-3 rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="flex items-center gap-1 text-rose-500 font-semibold">
                        <ShieldAlert className="w-3.5 h-3.5" /> 毒点风险指数 (TRI)
                      </span>
                      <span className={`font-bold ${simulation.toxicityScore > 30 ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {simulation.toxicityScore} / 100
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${simulation.toxicityScore > 30 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                        style={{ width: `${simulation.toxicityScore}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-blue-500">考据逻辑严密度</span>
                      <span className="font-bold text-blue-500">{simulation.logicScore} / 100</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-500 h-full rounded-full transition-all"
                        style={{ width: `${simulation.logicScore}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-amber-500">爽点满足感</span>
                      <span className="font-bold text-amber-500">{simulation.pleasureScore} / 100</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-amber-500 h-full rounded-full transition-all"
                        style={{ width: `${simulation.pleasureScore}%` }}
                      />
                    </div>
                  </div>
                </div>

                {simulation.toxicAlerts.length > 0 && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg text-xs text-rose-700 dark:text-rose-300 space-y-1">
                    <div className="font-semibold flex items-center gap-1 text-rose-600">
                      <AlertTriangle className="w-3.5 h-3.5" /> 读者毒发弃书高危警示：
                    </div>
                    {simulation.toxicAlerts.map((alt, idx) => (
                      <p key={idx}>{alt}</p>
                    ))}
                  </div>
                )}

                {simulation.suggestions.length > 0 && (
                  <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                    <div className="font-semibold text-slate-800 dark:text-slate-200">防杠优化建议：</div>
                    {simulation.suggestions.map((sug, idx) => (
                      <div key={idx} className="p-2 bg-slate-50 dark:bg-slate-900 rounded border border-slate-100 dark:border-slate-800">
                        {sug}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* 右侧：模拟段评弹幕瀑布流 */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3 flex flex-col">
            <div className="flex items-center justify-between border-b pb-2 border-slate-100 dark:border-slate-700">
              <span className="font-bold text-sm flex items-center gap-1.5 text-slate-800 dark:text-slate-100">
                <MessageSquare className="w-4 h-4 text-emerald-500" />
                虚拟段评弹幕流预演 ({simulation?.comments.length || 0} 条)
              </span>
              <span className="text-xs text-slate-400">基于语义特征触发的真实读者拟真反应</span>
            </div>

            <div className="space-y-2.5 overflow-y-auto flex-1 max-h-[560px]">
              {simulation?.comments.map((cmt) => (
                <div
                  key={cmt.id}
                  className="p-3 rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/60 space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {cmt.authorName}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] ${
                          cmt.sentiment === 'toxic_alert'
                            ? 'bg-rose-500/20 text-rose-500'
                            : cmt.sentiment === 'criticism'
                            ? 'bg-amber-500/20 text-amber-500'
                            : 'bg-emerald-500/20 text-emerald-500'
                        }`}
                      >
                        {cmt.persona === 'toxic_hunter'
                          ? '毒点排查官'
                          : cmt.persona === 'logic_critic'
                          ? '考据杠精'
                          : cmt.persona === 'pleasure_seeker'
                          ? '爽感追更'
                          : 'CP党'}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      👍 {cmt.upvotes}
                    </span>
                  </div>

                  <p className="text-slate-700 dark:text-slate-200 font-medium">
                    “{cmt.commentText}”
                  </p>

                  <div className="text-[10px] text-slate-400 truncate bg-white dark:bg-slate-800 p-1.5 rounded border border-slate-100 dark:border-slate-700">
                    触发原文：{cmt.targetSnippet}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
