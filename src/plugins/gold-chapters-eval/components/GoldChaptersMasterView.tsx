import { useState, useEffect, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import { indexedDbGoldChaptersRepository } from '../../../adapters/indexedDbGoldChaptersRepository'
import { GoldChaptersEngine } from '../engine/GoldChaptersEngine'
import type { GoldChapterEvalRecord } from '../types'
import { Award, Sparkles, Send } from 'lucide-react'
import { clock } from '../../../adapters/clock'
import { idGenerator } from '../../../adapters/idGenerator'

export const GoldChaptersMasterView: FC<DesktopPluginViewProps> = ({ projectId, onStats }) => {
  const [chaptersText, setChaptersText] = useState(
    '暴雨倾盆的断魂崖边，少年握紧染血的长刀，冷冷扫视着步步紧逼的追兵。\n“交出你父亲留下的古卷，尚可留你全尸！”为首的统领按刀狞笑。\n没有回应，唯有识海深处突然泛起冰冷浩瀚的共鸣波动——觉醒时刻已至！',
  )
  const [evaluations, setEvaluations] = useState<GoldChapterEvalRecord[]>([])

  const loadEvals = async () => {
    const all = await indexedDbGoldChaptersRepository.getAll(projectId)
    setEvaluations(all)
  }

  useEffect(() => {
    loadEvals().catch(console.error)
  }, [projectId])

  useEffect(() => {
    onStats?.({
      title: '黄金三章过稿诊断器',
      wordCount: chaptersText.length,
      updatedAt: clock.now(),
    })
  }, [chaptersText, onStats])

  const currentEval = GoldChaptersEngine.evaluate(chaptersText)

  const handleSave = async () => {
    const record: GoldChapterEvalRecord = {
      id: idGenerator.generate('gold'),
      projectId,
      score: currentEval.score,
      isQualified: currentEval.isQualified,
      motiveScore: currentEval.motiveScore,
      goldFingerScore: currentEval.goldFingerScore,
      conflictScore: currentEval.conflictScore,
      expectationScore: currentEval.expectationScore,
      keyDiagnosis: currentEval.keyDiagnosis,
      suggestions: currentEval.suggestions,
      evaluatedAt: clock.now(),
    }
    await indexedDbGoldChaptersRepository.save(record)
    await loadEvals()
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto text-slate-800 dark:text-slate-100">
      <div className="flex items-center justify-between border-b pb-4 border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Award className="w-6 h-6 text-amber-500" />
            <span>黄金三章与签约过稿诊断器 (GoldChaptersEval)</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            严格针对商业网文前三章（前3000字）的主角动机、金手指筹码与主要矛盾进行量化过稿诊断
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border rounded-xl p-5 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-3">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            前三章开篇文本输入:
          </label>
          <textarea
            className="w-full h-64 p-3 text-xs border rounded font-serif bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800 leading-relaxed"
            value={chaptersText}
            onChange={(e) => setChaptersText(e.target.value)}
          />
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold flex items-center gap-1.5 transition"
          >
            <Send className="w-4 h-4" /> 保存当前过稿评测快照
          </button>
        </div>

        <div className="border rounded-xl p-5 bg-slate-900 text-slate-100 border-amber-900/60 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-amber-400 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" /> 商业签约评测结论
            </span>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                currentEval.isQualified
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  : 'bg-rose-950 text-rose-400 border border-rose-800'
              }`}
            >
              {currentEval.isQualified ? '达到商业签约门槛' : '高危拒签预警'}
            </span>
          </div>

          <div className="text-center py-2 border-b border-slate-800">
            <div className="text-xs text-slate-400">综合过稿指数</div>
            <div
              className={`text-4xl font-black mt-1 ${
                currentEval.score >= 80
                  ? 'text-emerald-400'
                  : currentEval.score >= 70
                    ? 'text-amber-400'
                    : 'text-rose-400'
              }`}
            >
              {currentEval.score} <span className="text-sm font-normal text-slate-400">/ 100</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-2 rounded bg-slate-800 border border-slate-700">
              <div className="text-slate-400 text-[10px]">主角核心动机 (25%)</div>
              <div className="font-bold text-indigo-400 mt-0.5">{currentEval.motiveScore} 分</div>
            </div>
            <div className="p-2 rounded bg-slate-800 border border-slate-700">
              <div className="text-slate-400 text-[10px]">金手指/卖点登场 (30%)</div>
              <div className="font-bold text-amber-400 mt-0.5">
                {currentEval.goldFingerScore} 分
              </div>
            </div>
            <div className="p-2 rounded bg-slate-800 border border-slate-700">
              <div className="text-slate-400 text-[10px]">主要矛盾危机 (25%)</div>
              <div className="font-bold text-rose-400 mt-0.5">{currentEval.conflictScore} 分</div>
            </div>
            <div className="p-2 rounded bg-slate-800 border border-slate-700">
              <div className="text-slate-400 text-[10px]">3000字期待留钩 (20%)</div>
              <div className="font-bold text-emerald-400 mt-0.5">
                {currentEval.expectationScore} 分
              </div>
            </div>
          </div>

          <div className="space-y-1.5 pt-1 text-xs">
            <div className="font-bold text-slate-300">诊断特征:</div>
            {currentEval.keyDiagnosis.map((diag, idx) => (
              <div key={idx} className="text-slate-400 flex items-start gap-1">
                <span>•</span> <span>{diag}</span>
              </div>
            ))}

            {currentEval.suggestions.length > 0 && (
              <div className="pt-2">
                <div className="font-bold text-amber-400">靶向重写建议:</div>
                {currentEval.suggestions.map((sug, idx) => (
                  <div key={idx} className="text-amber-200/90 flex items-start gap-1">
                    <span>💡</span> <span>{sug}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {evaluations.length > 0 && (
        <div className="border-t pt-4 border-slate-200 dark:border-slate-800">
          <div className="text-xs font-bold text-slate-400 mb-2">
            历史评测快照 ({evaluations.length})
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {evaluations.map((e) => (
              <div
                key={e.id}
                className="p-3 bg-slate-100 dark:bg-slate-800 rounded min-w-[140px] text-xs space-y-1"
              >
                <div className="flex justify-between font-bold">
                  <span>得分: {e.score}</span>
                  <span className={e.isQualified ? 'text-emerald-500' : 'text-rose-500'}>
                    {e.isQualified ? '过稿' : '拒签'}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">
                  {new Date(e.evaluatedAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
