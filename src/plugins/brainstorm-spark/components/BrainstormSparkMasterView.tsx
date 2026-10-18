import { usePluginAiTask } from '../../../core/usePluginAiTask'
import { useOptionalPluginHostContext } from '../../../core/pluginHostContext'
import { PluginAiTaskPanel } from '../../../components/plugins/PluginAiTaskPanel'
import { semanticTextFromContent } from '../../../domain/content'
import { useState, useEffect, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import { BrainstormSparkEngine } from '../engine/BrainstormSparkEngine'
import type { BrainstormSpark, DilemmaType, SparkSolution } from '../types'
import { indexedDbBrainstormRepository } from '../../../adapters/indexedDbBrainstormRepository'
import { clock } from '../../../adapters/clock'
import { idGenerator } from '../../../adapters/idGenerator'
import { Lightbulb, Sparkles, BookmarkCheck } from 'lucide-react'

export const BrainstormSparkMasterView: FC<DesktopPluginViewProps> = (props) => (
  <SparkSession key={props.projectId} {...props} />
)
const SparkSession: FC<DesktopPluginViewProps> = ({ projectId }) => {
  const host = useOptionalPluginHostContext()
  const [error, setError] = useState<string | null>(null)
  const [knownResourcesText, setKnownResourcesText] = useState('')
  const [constraintsText, setConstraintsText] = useState('')
  const [historySparks, setHistorySparks] = useState<BrainstormSpark[]>([])
  const [dilemmaType, setDilemmaType] = useState<DilemmaType>('dead_end')
  // §P2.4：作者什么都没配时不替他选流派，四项困境要素一律从空白起步。
  const [coreProblem, setCoreProblem] = useState('')
  const [currentSituation, setCurrentSituation] = useState('')
  const [protagonistGoal, setProtagonistGoal] = useState('')
  const [enemyAdvantage, setEnemyAdvantage] = useState('')

  // 旧实现在挂载时就用示例困境跑引擎，八条仙侠味「破局方案」会先于作者输入出现（INV-05）。
  const inputIdentity = JSON.stringify([
    projectId,
    dilemmaType,
    coreProblem,
    currentSituation,
    protagonistGoal,
    enemyAdvantage,
    knownResourcesText,
    constraintsText,
  ])
  const [generatedRun, setGeneratedRun] = useState<{
    identity: string
    solutions: SparkSolution[]
  } | null>(null)
  const generatedSolutions = generatedRun?.identity === inputIdentity ? generatedRun.solutions : []
  const knownResources = knownResourcesText.split('\n').filter(Boolean)
  const constraints = constraintsText.split('\n').filter(Boolean)
  const semanticInput = {
    dilemmaType,
    coreProblem: semanticTextFromContent(`brainstorm-${projectId}-problem`, coreProblem),
    currentSituation: semanticTextFromContent(
      `brainstorm-${projectId}-situation`,
      currentSituation,
    ),
    protagonistGoal: semanticTextFromContent(`brainstorm-${projectId}-goal`, protagonistGoal),
    enemyAdvantage: semanticTextFromContent(`brainstorm-${projectId}-advantage`, enemyAdvantage),
    knownResources: knownResources
      .map((resource, index) =>
        semanticTextFromContent(`brainstorm-${projectId}-resource-${index}`, resource),
      )
      .filter(Boolean),
    constraints: constraints
      .map((constraint, index) =>
        semanticTextFromContent(`brainstorm-${projectId}-constraint-${index}`, constraint),
      )
      .filter(Boolean),
  }
  const ai = usePluginAiTask('brainstorm-spark', [inputIdentity])

  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null)

  const loadHistory = async () => {
    const all = await indexedDbBrainstormRepository.getAll(projectId)
    setHistorySparks(all.filter((record) => record.projectId === projectId))
  }

  useEffect(() => {
    void loadHistory().catch((cause) => setError(String(cause)))
  }, [projectId])

  // 留空时引擎会自行补「死局受制」这类套话，那等于把引擎编的情节当成作者的设定，所以四项都要填。
  const emptyFields: string[] = []
  if (!semanticInput.coreProblem.trim()) emptyFields.push('当前核心死局')
  if (!semanticInput.currentSituation.trim()) emptyFields.push('危机现状与紧迫感')
  if (!semanticInput.protagonistGoal.trim()) emptyFields.push('主角破局目标')
  if (!semanticInput.enemyAdvantage.trim()) emptyFields.push('敌方压倒性优势')
  const missingHint = emptyFields.length
    ? `填写困境后再生成：${emptyFields.join('、')} 尚未填写`
    : null

  const handleGenerate = () => {
    if (missingHint) {
      // 拒绝推演时把旧卡片一起撤下：界面不能留着与当前输入无关的结论（INV-09）。
      setGeneratedRun(null)
      return
    }
    const res = BrainstormSparkEngine.generateSolutions(semanticInput)
    setGeneratedRun({ identity: inputIdentity, solutions: res })
  }

  const handleSaveSpark = async (sol: SparkSolution) => {
    if (missingHint || generatedSolutions.length === 0) return
    const record: BrainstormSpark = {
      id: idGenerator.generate('spark'),
      projectId,
      dilemmaType,
      dilemmaTitle: coreProblem.slice(0, 20),
      coreProblem,
      currentSituation,
      protagonistGoal,
      enemyAdvantage,
      knownResources,
      constraints,
      selectedSolution: sol,
      generatedSolutions,
      tags: [dilemmaType],
      updatedAt: clock.now(),
    }
    try {
      await indexedDbBrainstormRepository.save(record)
      setSavedSuccessMsg(`已将「${sol.operatorName}」收录入灵感库`)
      await loadHistory()
      setError(null)
    } catch (cause) {
      setError(String(cause))
    }
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
            基于故事矛盾矩阵与八大逆向算子，检查已有条件与备选方案（已收录 {historySparks.length}{' '}
            条备选灵感）。
          </p>
        </div>
        {savedSuccessMsg && (
          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
            {savedSuccessMsg}
          </span>
        )}
      </div>

      {error && (
        <p role="alert">
          {error}
          <button onClick={() => void loadHistory().catch((cause) => setError(String(cause)))}>
            重新读取历史
          </button>
        </p>
      )}
      {/* 困境输入面板 */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl space-y-3 shadow-sm">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">困境类型：</span>
          {(['dead_end', 'moral_dilemma', 'identity_leak', 'clue_fracture'] as DilemmaType[]).map(
            (t) => (
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
            ),
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block text-slate-500 mb-1">当前核心死局：</label>
            <input
              type="text"
              value={coreProblem}
              onChange={(e) => setCoreProblem(e.target.value)}
              placeholder="例：主角被困在一处既打不过也退不走的死地"
              className="w-full p-2 bg-slate-50 dark:bg-slate-900 border rounded"
            />
          </div>
          <div>
            <label className="block text-slate-500 mb-1">敌方压倒性优势：</label>
            <input
              type="text"
              value={enemyAdvantage}
              onChange={(e) => setEnemyAdvantage(e.target.value)}
              placeholder="例：对方握着主角无法正面抗衡的人数与规矩"
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
              placeholder="例：合围还在收紧，能用的筹码已经见底"
              className="w-full p-2 bg-slate-50 dark:bg-slate-900 border rounded"
            />
          </div>
          <div>
            <label className="block text-slate-500 mb-1">主角破局目标：</label>
            <input
              type="text"
              value={protagonistGoal}
              onChange={(e) => setProtagonistGoal(e.target.value)}
              placeholder="例：活着脱身，同时不丢掉最关键的那一样东西"
              className="w-full p-2 bg-slate-50 dark:bg-slate-900 border rounded"
            />
          </div>
        </div>

        <textarea
          aria-label="已有筹码与线索"
          placeholder="已有筹码与线索，每行一项"
          value={knownResourcesText}
          onChange={(e) => setKnownResourcesText(e.target.value)}
        />
        <textarea
          aria-label="不可改变的条件"
          placeholder="不可改变的条件，每行一项"
          value={constraintsText}
          onChange={(e) => setConstraintsText(e.target.value)}
        />
        <div className="flex items-center justify-end gap-3 pt-1">
          {missingHint && (
            <span className="text-[11px] text-amber-600 dark:text-amber-400">{missingHint}</span>
          )}
          <button
            onClick={handleGenerate}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            推演 8 大逆向破局策略
          </button>
        </div>
      </div>

      {host?.aiAssistant?.isAvailable && (
        <button
          disabled={Boolean(missingHint) || ai.isRunning}
          onClick={() =>
            void ai.run({
              ...BrainstormSparkEngine.buildAnalysisInput(semanticInput),
              chapterText:
                host?.projectId === projectId && host.activeChapter
                  ? semanticTextFromContent(
                      host.activeChapter.id,
                      host.activeChapter.content ?? '',
                      host.activeChapter.revision,
                    )
                  : '',
            })
          }
        >
          AI 受约束方案复核
        </button>
      )}
      <PluginAiTaskPanel view={ai.view} onRetry={ai.retry} />
      {/* 8大破局方案展示：只有作者填齐困境并点过推演之后才有内容 */}
      {generatedSolutions.length === 0 ? (
        <div className="p-8 border rounded-xl text-center text-slate-400 text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          未配置困境：填齐上方四项再点「推演」，这里不会替你编故事
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] text-slate-400">
            以下是可选的设计问题与成立条件，使用作者提供的目标、筹码和限制；尚未决定具体情节。
          </p>
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
                      {sol.status === 'creative_option' ? '创作选项' : '旧模板未验证'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 italic">
                    {sol.corePrinciple}
                  </p>

                  <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 leading-relaxed mb-3">
                    <div className="font-semibold text-slate-900 dark:text-white mb-1">
                      推演情节：
                    </div>
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
      )}
    </div>
  )
}
