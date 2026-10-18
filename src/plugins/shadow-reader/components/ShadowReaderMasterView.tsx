import { useState, useEffect, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import { indexedDbShadowReaderRepository } from '../../../adapters/indexedDbShadowReaderRepository'
import { ShadowReaderEngine } from '../engine/ShadowReaderEngine'
import type { ShadowDanmakuRecord, ShadowSimulationResult } from '../types'
import { semanticTextFromContent } from '../../../domain/content'
import { MessageSquare, ShieldAlert, Sparkles, Send } from 'lucide-react'
import { clock } from '../../../adapters/clock'
import { idGenerator } from '../../../adapters/idGenerator'
import { useOptionalPluginHostContext } from '../../../core/pluginHostContext'
import { usePluginAiTask } from '../../../core/usePluginAiTask'
import { PluginAiTaskPanel } from '../../../components/plugins/PluginAiTaskPanel'
import { ScoreProvenanceBadge } from '../../../ui/atoms'

export const ShadowReaderMasterView: FC<DesktopPluginViewProps> = (props) => (
  <ShadowReaderWorkspaceView key={props.projectId} {...props} />
)
const ShadowReaderWorkspaceView: FC<DesktopPluginViewProps> = ({ projectId, onStats }) => {
  const host = useOptionalPluginHostContext()
  const activeChapter = host?.activeChapter
  const initialText = activeChapter
    ? semanticTextFromContent(activeChapter.id, activeChapter.content || '', activeChapter.revision)
    : ''
  const [chapterText, setChapterText] = useState(initialText)
  const sourceMatchesSavedChapter = Boolean(activeChapter && chapterText === initialText)
  const sourceKind = sourceMatchesSavedChapter ? 'saved-chapter' : 'edited-copy'
  const sourceRevision = sourceMatchesSavedChapter ? activeChapter?.revision : undefined
  const semanticChapterText = semanticTextFromContent(
    activeChapter?.id ?? `shadow-reader-${projectId}`,
    chapterText,
    sourceRevision ?? 0,
  )
  const aiTask = usePluginAiTask('shadow-reader', [
    activeChapter?.id,
    sourceRevision,
    sourceKind,
    chapterText,
  ])
  const [error, setError] = useState<string | null>(null)
  const [historyDanmakus, setHistoryDanmakus] = useState<ShadowDanmakuRecord[]>([])

  useEffect(() => {
    if (!activeChapter) {
      setChapterText('')
      return
    }
    setChapterText(
      semanticTextFromContent(
        activeChapter.id,
        activeChapter.content || '',
        activeChapter.revision,
      ),
    )
  }, [activeChapter?.id, activeChapter?.content, activeChapter?.revision])

  const loadHistory = async () => {
    const list = await indexedDbShadowReaderRepository.getAll(projectId)
    setHistoryDanmakus(list)
  }

  useEffect(() => {
    loadHistory().catch(console.error)
  }, [projectId])

  useEffect(() => {
    onStats?.({
      title: '读者知识与误读复核',
      wordCount: semanticChapterText.length,
      updatedAt: clock.now(),
    })
  }, [semanticChapterText, onStats])

  const simulation: ShadowSimulationResult = ShadowReaderEngine.simulate(
    semanticChapterText,
    activeChapter?.id ?? '',
  )

  const handleSaveDanmakus = async () => {
    if (!activeChapter) return
    setError(null)
    try {
      for (const d of simulation.danmakus) {
        const record: ShadowDanmakuRecord = {
          ...d,
          id: idGenerator.generate('dmk'),
          projectId,
          sourceKind,
          sourceRevision,
          createdAt: clock.now(),
        }
        await indexedDbShadowReaderRepository.save(record)
      }
      await loadHistory()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  const handleDelete = async (id: string) => {
    await indexedDbShadowReaderRepository.delete(id)
    await loadHistory()
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto text-slate-800 dark:text-slate-100">
      <div className="flex items-center justify-between border-b pb-4 border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-indigo-500" />
            <span>读者知识与误读复核 (ShadowReader)</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            本地定位词项复核问题；AI 按已读顺序区分明确的信息、推测和未知。
          </p>
          <ScoreProvenanceBadge source="rule" detail="词项不证明剧情事实或情绪，语义解释需要复核" />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            当前章节：
            {activeChapter?.title ?? '未选择章节，弹幕不会归档到任何章节'}
          </span>
          <button
            type="button"
            onClick={handleSaveDanmakus}
            disabled={!activeChapter || !simulation.danmakus.length}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded font-medium shadow-sm transition disabled:opacity-40 disabled:hover:bg-indigo-600"
          >
            <Send className="w-3.5 h-3.5" />
            <span>存入项目弹幕库 ({simulation.danmakus.length})</span>
          </button>
        </div>
      </div>

      {error && <p role="alert">{error}</p>}
      {host?.aiAssistant?.isAvailable && (
        <button
          type="button"
          disabled={aiTask.isRunning || !semanticChapterText.trim()}
          onClick={() => {
            void aiTask.run(
              ShadowReaderEngine.buildAnalysisInput(
                activeChapter?.title ?? '',
                semanticChapterText,
                {
                  chapterId: activeChapter?.id,
                  sourceKind,
                  sourceRevision,
                },
              ),
            )
          }}
        >
          AI 阅读顺序复核
        </button>
      )}
      <PluginAiTaskPanel view={aiTask.view} onRetry={aiTask.retry} />

      <p className="text-xs text-slate-500">
        定位到 {simulation.danmakus.length}{' '}
        条原文问题。每段每类仅展示首个词项；未命中不表示语义安全。
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border rounded-xl p-5 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-3">
          <label
            htmlFor="shadow-reader-chapter-text"
            className="text-xs font-bold text-slate-500 uppercase tracking-wider"
          >
            章节正文推演区:
          </label>
          <textarea
            id="shadow-reader-chapter-text"
            className="w-full h-80 p-3 text-xs border rounded font-serif bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800 leading-relaxed"
            value={chapterText}
            onChange={(e) => setChapterText(e.target.value)}
          />
        </div>

        <div className="border rounded-xl p-5 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 flex flex-col">
          <h3 className="text-sm font-bold flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span>本章原文复核问题 ({simulation.danmakus.length})</span>
            </span>
            {simulation.toxicAlertCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-rose-500 font-bold bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-900/50">
                <ShieldAlert className="w-3.5 h-3.5" />
                {simulation.toxicAlertCount} 处毒点高危
              </span>
            )}
          </h3>

          <div className="space-y-3 mt-4 overflow-y-auto max-h-[300px] pr-1">
            {simulation.danmakus.length === 0 ? (
              <div className="text-xs text-slate-400 py-10 text-center">
                词表没有命中；读者能否理解仍需正文、前文和语境分析。
              </div>
            ) : (
              simulation.danmakus.map((d, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                    d.isToxicAlert
                      ? 'bg-rose-50/60 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900'
                      : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {d.personaName}
                      </span>
                      <span className="text-slate-400 text-[10px]">
                        第 {d.paragraphIndex + 1} 段
                      </span>
                    </span>
                    {d.isToxicAlert && (
                      <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">
                        毒点类别: {d.toxicCategory}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-700 dark:text-slate-200">{d.content}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {historyDanmakus.length > 0 && (
        <div className="border rounded-xl p-5 bg-slate-50/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 space-y-3">
          <h3 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
            已归档复核快照 ({historyDanmakus.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {historyDanmakus.map((item) => (
              <div
                key={item.id}
                className="p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs space-y-1 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                    <span>{item.personaName}</span>
                    <span>{item.chapterId}</span>
                  </div>
                  <p className="text-slate-500">
                    {item.sourceKind === 'edited-copy'
                      ? '本地编辑副本，未绑定保存修订'
                      : item.sourceKind === 'saved-chapter' && item.sourceRevision !== undefined
                        ? `来源保存修订 ${item.sourceRevision}`
                        : item.sourceQuote
                          ? '来源修订未知'
                          : '旧记录未保存原文来源'}
                  </p>
                  <p className="text-slate-800 dark:text-slate-200">{item.content}</p>
                  {!item.sourceQuote && (
                    <p className="text-slate-500">旧模拟记录，未经语义验证。</p>
                  )}
                </div>
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className="text-[10px] text-slate-400 hover:text-rose-500 transition"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
