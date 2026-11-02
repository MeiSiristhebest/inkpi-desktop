import { semanticTextFromContent } from '../../../domain/content'
import {
  projectChapterSequence,
  type PositionedChapter,
} from '../../../domain/chapter/chapterSequence'
import type { PluginWorkflowSource } from '../../../types/pluginHost'
import { useState, useEffect, useMemo, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import { ReaderSimulatorEngine } from '../engine/ReaderSimulatorEngine'
import type { ChapterSimulationResult } from '../types'
import type { ReaderSimulationRecord } from '../../../ports/readerSimulationRepository'
import { indexedDbReaderSimulationRepository } from '../../../adapters/indexedDbReaderSimulationRepository'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import { clock } from '../../../adapters/clock'
import { idGenerator } from '../../../adapters/idGenerator'
import { useOptionalPluginHostContext } from '../../../core/pluginHostContext'
import { usePluginAiTask } from '../../../core/usePluginAiTask'
import { PluginAiTaskPanel } from '../../../components/plugins/PluginAiTaskPanel'
import { Users, AlertTriangle, MessageSquare, BookmarkCheck, RefreshCw, Bot } from 'lucide-react'
import { ScoreProvenanceBadge } from '../../../ui/atoms'
import { Select } from '../../../ui/primitives'

export const ReaderSimulatorMasterView: FC<DesktopPluginViewProps> = (props) => (
  <ReaderSimulatorWorkspaceView key={props.projectId} {...props} />
)
const ReaderSimulatorWorkspaceView: FC<DesktopPluginViewProps> = ({ projectId }) => {
  const hostContext = useOptionalPluginHostContext()
  const [chapters, setChapters] = useState<PositionedChapter[]>([])
  const [selectedChapterId, setSelectedChapterId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null)
  const [savedRecords, setSavedRecords] = useState<ReaderSimulationRecord[]>([])

  const loadChapters = async () => {
    setLoading(true)
    setError(null)
    try {
      const [all, volumes] = await Promise.all([
        indexedDbProjectRepository.getChaptersByProject(projectId),
        indexedDbProjectRepository.getVolumesByProject(projectId),
      ])
      const positioned = projectChapterSequence(projectId, all, volumes)
      setChapters(positioned)
      if (positioned.length > 0 && !selectedChapterId) {
        setSelectedChapterId(positioned[0].id)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadChapters()
  }, [projectId])

  useEffect(() => {
    let disposed = false
    void indexedDbReaderSimulationRepository
      .getAll(projectId)
      .then((records) => {
        if (!disposed) setSavedRecords(records.sort((a, b) => b.updatedAt - a.updatedAt))
      })
      .catch((cause) => {
        if (!disposed) setError(cause instanceof Error ? cause.message : String(cause))
      })

    return () => {
      disposed = true
    }
  }, [projectId])

  const currentChapter = chapters.find((c) => c.id === selectedChapterId)
  const aiTask = usePluginAiTask('reader-simulator', [
    currentChapter?.id,
    currentChapter?.revision,
    currentChapter?.content,
  ])

  const simulation: ChapterSimulationResult | null = useMemo(() => {
    if (!currentChapter || currentChapter.chapterNumber === null) return null
    return ReaderSimulatorEngine.simulateChapter({
      chapterId: currentChapter.id,
      chapterTitle: currentChapter.title,
      chapterOrder: currentChapter.chapterNumber,
      sourceRevision: currentChapter.revision,
      content:
        semanticTextFromContent(
          currentChapter.id,
          currentChapter.content || '',
          currentChapter.revision,
        ) || '',
    })
  }, [currentChapter])

  // Generate hypothetical reader profiles from the supplied chapter text.
  const handleAiReaderSimulate = async () => {
    if (!currentChapter || currentChapter.chapterNumber === null) return
    const chapterText = semanticTextFromContent(
      currentChapter.id,
      currentChapter.content || '',
      currentChapter.revision,
    )
    if (!chapterText) return
    const analysisInput = ReaderSimulatorEngine.buildAnalysisInput({
      chapterId: currentChapter.id,
      chapterTitle: currentChapter.title,
      chapterOrder: currentChapter.chapterNumber,
      sourceRevision: currentChapter.revision,
      content: chapterText,
    })

    const source: PluginWorkflowSource = {
      kind: 'saved-chapter',
      documentId: currentChapter.id,
    }
    await aiTask.run(analysisInput, undefined, source)
  }

  const handleSaveSimulation = async () => {
    if (!simulation?.comments.length) return
    setError(null)
    try {
      const record: ReaderSimulationRecord = {
        id: idGenerator.generate('rsim'),
        projectId,
        chapterId: simulation.chapterId,
        chapterTitle: simulation.chapterTitle,
        chapterOrder: simulation.chapterOrder,
        sourceRevision: simulation.sourceRevision,
        comments: simulation.comments,
        toxicAlerts: simulation.toxicAlerts,
        suggestions: simulation.suggestions,
        updatedAt: clock.now(),
      }
      await indexedDbReaderSimulationRepository.save(record)
      setSavedRecords((current) => [record, ...current.filter((item) => item.id !== record.id)])
      setSavedSuccessMsg('已保存当前章复核问题快照')
      setTimeout(() => setSavedSuccessMsg(null), 2500)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  return (
    <div className="plugin-workspace-page p-6 h-full flex flex-col space-y-4 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 overflow-y-auto">
      {/* 头部标题与控制区 */}
      <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <Users className="w-6 h-6 text-emerald-600" />
            读者视角复核 (Reader Simulator)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            规则结果是文本提示；AI
            输出是基于设定画像的模拟，不代表真实读者反馈、留存、转化、订阅或销售数据。
          </p>
          <ScoreProvenanceBadge source="rule" detail="词项只定位复核问题；不能推断受众反应" />
        </div>
        <div className="flex items-center gap-2">
          {savedSuccessMsg && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              {savedSuccessMsg}
            </span>
          )}
          {hostContext?.aiAssistant?.isAvailable && (
            <button
              disabled={
                aiTask.isRunning || !currentChapter || currentChapter.chapterNumber === null
              }
              onClick={handleAiReaderSimulate}
              className="px-3 py-1.5 text-xs font-medium bg-[var(--ink-accent)] text-white rounded-lg hover:opacity-90 transition flex items-center gap-1 shadow-sm cursor-pointer"
            >
              <Bot className="w-3.5 h-3.5" />
              AI 假设读者段评模拟
            </button>
          )}
          <PluginAiTaskPanel view={aiTask.view} onRetry={aiTask.retry} />
          <button
            onClick={handleSaveSimulation}
            disabled={!simulation?.comments.length}
            className="px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition flex items-center gap-1 shadow-sm cursor-pointer"
          >
            <BookmarkCheck className="w-3.5 h-3.5" />
            保存复核问题
          </button>
          <button
            onClick={loadChapters}
            className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            重新推演
          </button>
        </div>
      </div>

      {error && <p role="alert">{error}</p>}
      {currentChapter?.chapterNumber === null && (
        <p role="status">该章节尚未关联到有效分卷，无法提供可信的全书章节序号。</p>
      )}
      {loading ? (
        <div className="text-center py-12 text-slate-400">正在读取章节...</div>
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
              <Select
                aria-label="预演章节"
                value={selectedChapterId}
                onValueChange={(v) => setSelectedChapterId(v)}
                className="w-full"
                size="sm"
              >
                {chapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.chapterNumber === null ? '章节位置未知' : `第 ${c.chapterNumber} 章`}：
                    {c.title}
                  </option>
                ))}
              </Select>
            </div>

            {simulation && (
              <>
                <p className="text-xs text-slate-500">
                  本地定位到 {simulation.comments.length} 类词项复核问题。每类仅展示首个命中的语境。
                  未命中不表示没有问题；读者解读需要结合全文与画像，不能由词项计算分数。
                </p>

                {simulation.toxicAlerts.length > 0 && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg text-xs text-rose-700 dark:text-rose-300 space-y-1">
                    <div className="font-semibold flex items-center gap-1 text-rose-600">
                      <AlertTriangle className="w-3.5 h-3.5" /> 文本规则提示：可能影响阅读体验的线索
                    </div>
                    {simulation.toxicAlerts.map((alt, idx) => (
                      <p key={idx}>{alt}</p>
                    ))}
                  </div>
                )}

                {simulation.suggestions.length > 0 && (
                  <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                      待复核建议：
                    </div>
                    {simulation.suggestions.map((sug, idx) => (
                      <div
                        key={idx}
                        className="p-2 bg-slate-50 dark:bg-slate-900 rounded border border-slate-100 dark:border-slate-800"
                      >
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
                原文与复核问题 ({simulation?.comments.length || 0} 条)
              </span>
              <span className="text-xs text-slate-400">原文定位不代表已完成语义分析</span>
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
                    <span className="text-[10px] text-slate-400">复核问题</span>
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
      {savedRecords.length > 0 && (
        <section
          aria-label="已保存的复核快照"
          className="border rounded-xl p-4 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 space-y-3"
        >
          <h3 className="text-sm font-semibold">已保存的复核快照</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {savedRecords.slice(0, 10).map((record) => (
              <article
                key={record.id}
                className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-1.5 text-xs"
              >
                <h4 className="font-medium">
                  第 {record.chapterOrder} 章：{record.chapterTitle}
                </h4>
                <p className="text-slate-500">
                  {record.sourceRevision === undefined
                    ? '来源修订未知'
                    : `来源保存修订 ${record.sourceRevision}`}
                  {' · '}
                  {record.comments.length} 条复核问题
                </p>
                {record.comments.slice(0, 3).map((comment) => (
                  <p key={comment.id} className="text-slate-600 dark:text-slate-300">
                    原文：{comment.targetSnippet}
                  </p>
                ))}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
