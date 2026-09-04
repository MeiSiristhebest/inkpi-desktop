import { useState, useEffect, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import { BrainstormSparkEngine } from '../engine/BrainstormSparkEngine'
import type { BrainstormSpark, DilemmaType, SparkSolution } from '../types'
import { indexedDbBrainstormRepository } from '../../../adapters/indexedDbBrainstormRepository'
import { clock } from '../../../adapters/clock'
import { idGenerator } from '../../../adapters/idGenerator'
import { Lightbulb, Sparkles, BookmarkCheck } from 'lucide-react'

export const BrainstormSparkMasterView: FC<DesktopPluginViewProps> = ({ projectId }) => {
  const [historySparks, setHistorySparks] = useState<BrainstormSpark[]>([])
  const [dilemmaType, setDilemmaType] = useState<DilemmaType>('dead_end')
  const [coreProblem, setCoreProblem] = useState('主角身处敌宗禁地，退路被元婴大阵彻底锁死')
  const [currentSituation, setCurrentSituation] = useState('四面受伏，警钟长鸣，灵力即将枯竭')
  const [protagonistGoal, setProtagonistGoal] = useState('保全性命并带走九叶仙草逃离禁地')
  const [enemyAdvantage, setEnemyAdvantage] = useState('宗门主场压制，人多势众且有护宗大阵')

  const [generatedSolutions, setGeneratedSolutions] = useState<SparkSolution[]>(() =>
    BrainstormSparkEngine.generateSolutions({
      dilemmaType: 'dead_end',
      coreProblem: '主角身处敌宗禁地，退路被元婴大阵彻底锁死',
      currentSituation: '四面受伏，警钟长鸣，灵力即将枯竭',
      protagonistGoal: '保全性命并带走九叶仙草逃离禁地',
      enemyAdvantage: '宗门主场压制，人多势众且有护宗大阵',
    })
  )

  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null)

  const loadHistory = async () => {
    const all = await indexedDbBrainstormRepository.getAll(projectId)
    setHistorySparks(all)
  }

  useEffect(() => {
    loadHistory()
  }, [projectId])

  const handleGenerate = () => {
    const res = BrainstormSparkEngine.generateSolutions({
      dilemmaType,
      coreProblem,
      currentSituation,
      protagonistGoal,
      enemyAdvantage,
    })
    setGeneratedSolutions(res)
  }

  const handleSaveSpark = async (sol: SparkSolution) => {
    const record: BrainstormSpark = {
      id: idGenerator.generate('spark'),
      projectId,
      dilemmaType,
      dilemmaTitle: coreProblem.slice(0, 20),
      coreProblem,
      currentSituation,
      protagonistGoal,
      enemyAdvantage,
      selectedSolution: sol,
      generatedSolutions,
      tags: [dilemmaType],
      updatedAt: clock.now(),
    }
    await indexedDbBrainstormRepository.save(record)
    setSavedSuccessMsg(`已将「${sol.operatorName}」收录入灵感库`)
    setTimeout(() => setSavedSuccessMsg(null), 2500)
    loadHistory()
  }

  return (
    <div className="p-6 h-full flex flex-col space-y-4 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 overflow-y-auto">
      <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <Lightbulb className="w-6 h-6 text-amber-500" />
            灵感火花与困境脱壳破局炉 (Brainstorm Spark)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            基于故事矛盾矩阵与八大逆向算子，终结卡文绝境（已收录 {historySparks.length} 条备选灵感）。
          </p>
        </div>
        {savedSuccessMsg && (
          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
            {savedSuccessMsg}
          </span>
        )}
      </div>

      {/* 困境输入面板 */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl space-y-3 shadow-sm">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">困境类型：</span>
          {(['dead_end', 'moral_dilemma', 'identity_leak', 'clue_fracture'] as DilemmaType[]).map((t) => (
            <button
              key={t}
              onClick={() => setDilemmaType(t)}
              className={`px-2.5 py-1 rounded-full transition ${
                dilemmaType === t
                  ? 'bg-amber-500 text-white font-medium'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {t === 'dead_end'
                ? '必死绝境'
                : t === 'moral_dilemma'
                ? '两难抉择'
                : t === 'identity_leak'
                ? '身份暴雷'
                : '逻辑断链'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block text-slate-500 mb-1">当前核心死局：</label>
            <input
              type="text"
              value={coreProblem}
              onChange={(e) => setCoreProblem(e.target.value)}
              className="w-full p-2 bg-slate-50 dark:bg-slate-900 border rounded"
            />
          </div>
          <div>
            <label className="block text-slate-500 mb-1">敌方压倒性优势：</label>
            <input
              type="text"
              value={enemyAdvantage}
              onChange={(e) => setEnemyAdvantage(e.target.value)}
              className="w-full p-2 bg-slate-50 dark:bg-slate-900 border rounded"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block text-slate-500 mb-1">危机现状与紧迫感：</label>
            <input
              type="text"
              value={currentSituation}
              onChange={(e) => setCurrentSituation(e.target.value)}
              className="w-full p-2 bg-slate-50 dark:bg-slate-900 border rounded"
            />
          </div>
          <div>
            <label className="block text-slate-500 mb-1">主角破局目标：</label>
            <input
              type="text"
              value={protagonistGoal}
              onChange={(e) => setProtagonistGoal(e.target.value)}
              className="w-full p-2 bg-slate-50 dark:bg-slate-900 border rounded"
            />
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            onClick={handleGenerate}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            推演 8 大逆向破局策略
          </button>
        </div>
      </div>

      {/* 8大破局方案展示 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {generatedSolutions.map((sol) => (
          <div
            key={sol.operatorId}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:border-amber-400 dark:hover:border-amber-500 transition"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  {sol.operatorName}
                </span>
                <span
                  className={`px-2 py-0.5 text-[10px] rounded font-semibold ${
                    sol.twistImpact === 'earthshaking'
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                  }`}
                >
                  {sol.twistImpact === 'earthshaking' ? '剧震级反转' : '精彩顿挫'}
                </span>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 italic">
                {sol.corePrinciple}
              </p>

              <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 leading-relaxed mb-3">
                <div className="font-semibold text-slate-900 dark:text-white mb-1">推演情节：</div>
                {sol.concretePlot}
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] mb-3">
                <div className="text-emerald-600 dark:text-emerald-400">
                  <span className="font-semibold">优势：</span>
                  {sol.pros}
                </div>
                <div className="text-rose-600 dark:text-rose-400">
                  <span className="font-semibold">隐患：</span>
                  {sol.cons}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => handleSaveSpark(sol)}
                className="px-2.5 py-1 text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded flex items-center gap-1 transition"
              >
                <BookmarkCheck className="w-3.5 h-3.5" />
                采纳为备选灵感
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
