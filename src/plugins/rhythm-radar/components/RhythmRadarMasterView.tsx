import { useState, useEffect, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import { indexedDbRhythmRadarRepository } from '../../../adapters/indexedDbRhythmRadarRepository'
import { RhythmRadarEngine } from '../engine/RhythmRadarEngine'
import type { RhythmRadarReportRecord } from '../types'
import { Activity, Zap, Anchor, Sparkles } from 'lucide-react'
import { clock } from '../../../adapters/clock'
import { idGenerator } from '../../../adapters/idGenerator'
import { ScoreProvenanceBadge } from '../../../ui/atoms'

export const RhythmRadarMasterView: FC<DesktopPluginViewProps> = ({ projectId, onStats }) => {
  const [chapterText, setChapterText] = useState('')

  const loadReports = async () => {
    await indexedDbRhythmRadarRepository.getAll(projectId)
  }

  useEffect(() => {
    loadReports().catch(console.error)
  }, [projectId])

  useEffect(() => {
    onStats?.({
      title: '剧情节奏与断章雷达',
      wordCount: chapterText.length,
      updatedAt: clock.now(),
    })
  }, [chapterText, onStats])

  const analysis = chapterText.trim()
    ? RhythmRadarEngine.analyzeChapter(chapterText, 'ch-manual', 1)
    : null

  const handleSaveReport = async () => {
    if (!analysis) return

    const record: RhythmRadarReportRecord = {
      id: idGenerator.generate('radar'),
      projectId,
      chapterId: 'ch-manual',
      chapterOrder: 1,
      tensionScore: analysis.tensionScore,
      pacingStatus: analysis.pacingStatus,
      cliffhanger: analysis.cliffhanger,
      actionDensity: analysis.actionDensity,
      sentimentValence: analysis.sentimentValence,
      generatedAt: clock.now(),
    }
    await indexedDbRhythmRadarRepository.save(record)
    await loadReports()
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto text-slate-800 dark:text-slate-100">
      <div className="flex items-center justify-between border-b pb-4 border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6 text-indigo-500" />
            <span>剧情节奏与断章雷达 (RhythmRadar)</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            按固定词表权重分析当前正文，给出节奏线索供作者核对；结果不代表读者反馈。
          </p>
          <ScoreProvenanceBadge source="rule" detail="动作/唤起/冲突三类词频加权，权重固定" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border rounded-xl p-5 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-3">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            章节正文节奏透视:
          </label>
          <textarea
            className="w-full h-44 p-3 text-xs border rounded font-serif bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800 leading-relaxed"
            value={chapterText}
            onChange={(e) => setChapterText(e.target.value)}
            placeholder="粘贴章节正文后查看规则分析"
          />
          <button
            onClick={handleSaveReport}
            disabled={!analysis}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold flex items-center gap-1.5 transition"
          >
            <Sparkles className="w-4 h-4" /> 归档当前断章雷达评测
          </button>
        </div>

        {analysis ? (
          <div className="border rounded-xl p-5 bg-slate-900 text-slate-100 border-indigo-900 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-indigo-400 flex items-center gap-1.5">
                <Zap className="w-4 h-4" /> 规则分析线索
              </span>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                  analysis.pacingStatus === 'optimal'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : analysis.pacingStatus === 'dragged'
                      ? 'bg-amber-950 text-amber-400 border border-amber-800'
                      : 'bg-rose-950 text-rose-400 border border-rose-800'
                }`}
              >
                {analysis.pacingStatus === 'optimal'
                  ? '相对稳定'
                  : analysis.pacingStatus === 'dragged'
                    ? '节奏偏慢'
                    : '情绪词较集中'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center text-xs">
              <div className="p-2.5 rounded bg-slate-800 border border-slate-700">
                <div className="text-slate-400 text-[10px]">复合张力指数</div>
                <div className="text-xl font-black text-indigo-400 mt-1">
                  {Math.round(analysis.tensionScore * 100)}%
                </div>
              </div>
              <div className="p-2.5 rounded bg-slate-800 border border-slate-700">
                <div className="text-slate-400 text-[10px]">动作冲突密度</div>
                <div className="text-xl font-black text-amber-400 mt-1">
                  {Math.round(analysis.actionDensity * 100)}%
                </div>
              </div>
              <div className="p-2.5 rounded bg-slate-800 border border-slate-700">
                <div className="text-slate-400 text-[10px]">情感极性振幅</div>
                <div className="text-xl font-black text-emerald-400 mt-1">
                  {Math.round(analysis.sentimentValence * 100)}%
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-950 border border-indigo-900/60 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-amber-400 flex items-center gap-1.5">
                  <Anchor className="w-4 h-4" /> 规则提示的断章位置: [
                  {analysis.cliffhanger.type.toUpperCase()}]
                </span>
              </div>
              <p className="text-xs text-slate-300 font-serif leading-relaxed">
                💡 {analysis.cliffhanger.hookPrompt}
              </p>
              <div className="p-2 rounded bg-slate-900 border border-slate-800 text-[11px] text-amber-200 font-mono">
                定格金句建议: "{analysis.cliffhanger.punchline}"
              </div>
            </div>
          </div>
        ) : (
          <div
            role="status"
            className="border rounded-xl p-5 bg-slate-900 text-slate-100 border-indigo-900 shadow-xl"
          >
            输入章节正文后显示规则分析。当前结果只用于提示词表命中，不代表读者反馈。
          </div>
        )}
      </div>
    </div>
  )
}
