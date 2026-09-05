import { useState, useEffect, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import { indexedDbShadowReaderRepository } from '../../../adapters/indexedDbShadowReaderRepository'
import { ShadowReaderEngine } from '../engine/ShadowReaderEngine'
import type { ShadowDanmakuRecord, ShadowSimulationResult } from '../types'
import {
  MessageSquare,
  Flame,
  ThumbsUp,
  AlertTriangle,
  ShieldAlert,
  Sparkles,
  Send,
} from 'lucide-react'
import { clock } from '../../../adapters/clock'
import { idGenerator } from '../../../adapters/idGenerator'
import { useOptionalPluginHostContext } from '../../../core/pluginHostContext'

export const ShadowReaderMasterView: FC<DesktopPluginViewProps> = ({ projectId, onStats }) => {
  const host = useOptionalPluginHostContext()
  const initialText =
    host?.activeChapter?.content ||
    '长夜漫漫，寒风掠过废弃的大殿。\n主角按捺住胸中翻腾的杀意，选择暂避锋芒。\n然而黑暗深处的冷笑声骤然撕破死寂，致命的杀招毫无征兆地贴面袭来！'
  const [chapterText, setChapterText] = useState(initialText)
  const [activeChapterId, setActiveChapterId] = useState(host?.activeChapter?.id || 'ch_01')
  const [historyDanmakus, setHistoryDanmakus] = useState<ShadowDanmakuRecord[]>([])

  const loadHistory = async () => {
    const list = await indexedDbShadowReaderRepository.getAll(projectId)
    setHistoryDanmakus(list)
  }

  useEffect(() => {
    loadHistory().catch(console.error)
  }, [projectId])

  useEffect(() => {
    onStats?.({
      title: '读者弹幕与毒点模拟器',
      wordCount: chapterText.length,
      updatedAt: clock.now(),
    })
  }, [chapterText, onStats])

  const simulation: ShadowSimulationResult = ShadowReaderEngine.simulate(
    chapterText,
    activeChapterId,
  )

  const handleSaveDanmakus = async () => {
    for (const d of simulation.danmakus) {
      const record: ShadowDanmakuRecord = {
        ...d,
        id: idGenerator.generate('dmk'),
        projectId,
        createdAt: clock.now(),
      }
      await indexedDbShadowReaderRepository.save(record)
    }
    await loadHistory()
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
            <span>读者弹幕与毒点预判模拟器 (ShadowReader)</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            基于 5 大认知肖像模型实时推演读者心智弹幕、识别圣母/送女/憋屈等商业毒点警报
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            className="px-3 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
            placeholder="当前章节ID"
            value={activeChapterId}
            onChange={(e) => setActiveChapterId(e.target.value)}
          />
          <button
            type="button"
            onClick={handleSaveDanmakus}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded font-medium shadow-sm transition"
          >
            <Send className="w-3.5 h-3.5" />
            <span>存入项目弹幕库 ({simulation.danmakus.length})</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 flex items-center gap-3">
          <Flame className="w-8 h-8 text-rose-500" />
          <div>
            <div className="text-xs text-rose-600 dark:text-rose-400 font-medium">
              暴怒/弃书毒点
            </div>
            <div className="text-xl font-bold text-rose-700 dark:text-rose-300">
              {simulation.sentimentSummary.rage} 条
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl border bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 flex items-center gap-3">
          <ThumbsUp className="w-8 h-8 text-emerald-500" />
          <div>
            <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              高潮喝彩/爽感
            </div>
            <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
              {simulation.sentimentSummary.applause} 条
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl border bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40 flex items-center gap-3">
          <AlertTriangle className="w-8 h-8 text-amber-500" />
          <div>
            <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              逻辑疑虑/伏笔
            </div>
            <div className="text-xl font-bold text-amber-700 dark:text-amber-300">
              {simulation.sentimentSummary.suspicious} 条
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl border bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900/40 flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-purple-500" />
          <div>
            <div className="text-xs text-purple-600 dark:text-purple-400 font-medium">
              期待/兴奋激动
            </div>
            <div className="text-xl font-bold text-purple-700 dark:text-purple-300">
              {simulation.sentimentSummary.excited} 条
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border rounded-xl p-5 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-3">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            章节正文推演区:
          </label>
          <textarea
            className="w-full h-80 p-3 text-xs border rounded font-serif bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800 leading-relaxed"
            value={chapterText}
            onChange={(e) => setChapterText(e.target.value)}
          />
        </div>

        <div className="border rounded-xl p-5 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 flex flex-col">
          <h3 className="text-sm font-bold flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span>本章实时推演拟真弹幕 ({simulation.danmakus.length})</span>
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
                暂未捕捉到高辨识度读者情绪反应，正文叙事平稳。
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
            已归档推演弹幕条目 ({historyDanmakus.length})
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
                  <p className="text-slate-800 dark:text-slate-200">{item.content}</p>
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
