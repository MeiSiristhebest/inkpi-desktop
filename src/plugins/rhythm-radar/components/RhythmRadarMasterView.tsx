import { useState, useEffect, type FC } from "react"
import type { DesktopPluginViewProps } from "../../../types/plugin"
import { indexedDbRhythmRadarRepository } from "../../../adapters/indexedDbRhythmRadarRepository"
import { RhythmRadarEngine } from "../engine/RhythmRadarEngine"
import type { RhythmRadarReportRecord } from "../types"
import { Activity, Zap, Anchor, Sparkles } from "lucide-react"
import { clock } from "../../../adapters/clock"
import { idGenerator } from "../../../adapters/idGenerator"

export const RhythmRadarMasterView: FC<DesktopPluginViewProps> = ({ projectId, onStats }) => {
  
  const [chapterText, setChapterText] = useState("林凡凌空踏步，长剑撕裂苍穹！雷霆万钧轰然落下，地面寸寸爆裂崩塌，那黑衣刺客冷笑一声摘下面具道：原来我才是真正的执剑人。")

  const loadReports = async () => {
    await indexedDbRhythmRadarRepository.getAll(projectId)
    }

  useEffect(() => {
    loadReports().catch(console.error)
  }, [projectId])

  useEffect(() => {
    onStats?.({
      title: "剧情节奏与断章雷达",
      wordCount: chapterText.length,
      updatedAt: clock.now(),
    })
  }, [chapterText, onStats])

  const analysis = RhythmRadarEngine.analyzeChapter(chapterText, "ch-manual", 1)

  const handleSaveReport = async () => {
    const record: RhythmRadarReportRecord = {
      id: idGenerator.generate("radar"),
      projectId,
      chapterId: "ch-manual",
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
            测算全卷情感极性与叙事密度张力曲线，智能推荐生死/反转/高潮/颠覆 4 大黄金断章切口
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border rounded-xl p-5 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-3">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">章节正文节奏透视:</label>
          <textarea
            className="w-full h-44 p-3 text-xs border rounded font-serif bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800 leading-relaxed"
            value={chapterText}
            onChange={(e) => setChapterText(e.target.value)}
          />
          <button
            onClick={handleSaveReport}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold flex items-center gap-1.5 transition"
          >
            <Sparkles className="w-4 h-4" /> 归档当前断章雷达评测
          </button>
        </div>

        <div className="border rounded-xl p-5 bg-slate-900 text-slate-100 border-indigo-900 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-indigo-400 flex items-center gap-1.5">
              <Zap className="w-4 h-4" /> 叙事张力与节奏健康度
            </span>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
              analysis.pacingStatus === "optimal"
                ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                : analysis.pacingStatus === "dragged"
                ? "bg-amber-950 text-amber-400 border border-amber-800"
                : "bg-rose-950 text-rose-400 border border-rose-800"
            }`}>
              {analysis.pacingStatus === "optimal" ? "黄金节律" : analysis.pacingStatus === "dragged" ? "拖沓水文预警" : "审美疲劳预警"}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center text-xs">
            <div className="p-2.5 rounded bg-slate-800 border border-slate-700">
              <div className="text-slate-400 text-[10px]">复合张力指数</div>
              <div className="text-xl font-black text-indigo-400 mt-1">{Math.round(analysis.tensionScore * 100)}%</div>
            </div>
            <div className="p-2.5 rounded bg-slate-800 border border-slate-700">
              <div className="text-slate-400 text-[10px]">动作冲突密度</div>
              <div className="text-xl font-black text-amber-400 mt-1">{Math.round(analysis.actionDensity * 100)}%</div>
            </div>
            <div className="p-2.5 rounded bg-slate-800 border border-slate-700">
              <div className="text-slate-400 text-[10px]">情感极性振幅</div>
              <div className="text-xl font-black text-emerald-400 mt-1">{Math.round(analysis.sentimentValence * 100)}%</div>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950 border border-indigo-900/60 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-amber-400 flex items-center gap-1.5">
                <Anchor className="w-4 h-4" /> 推荐黄金断章切口: [{analysis.cliffhanger.type.toUpperCase()}]
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
      </div>
    </div>
  )
}
