import { useState, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import { BrainstormSparkEngine } from '../engine/BrainstormSparkEngine'
import type { DilemmaType, SparkSolution } from '../types'
import { clipboardWriter } from '../../../adapters/clipboardWriter'
import { Lightbulb, Copy, Check, Sparkles } from 'lucide-react'

export const BrainstormSparkDrawer: FC<DesktopPluginDrawerProps> = ({ currentText }) => {
  const [dilemmaType, setDilemmaType] = useState<DilemmaType>('dead_end')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  // §P2.4：抽屉不再在渲染时替作者跑引擎，方案只能来自一次显式点击 + 作者自己的选段。
  const [solutions, setSolutions] = useState<SparkSolution[]>([])
  const [notice, setNotice] = useState<string | null>(null)

  const excerpt = currentText.trim().slice(-60)

  const handleRun = () => {
    if (!excerpt) {
      setSolutions([])
      setNotice('未选中正文：先在编辑器里圈出那段卡住的危机')
      return
    }
    setNotice(null)
    setSolutions(
      BrainstormSparkEngine.generateSolutions({
        dilemmaType,
        coreProblem: excerpt,
        // 抽屉没有另外三项的入口，留空而不是替作者编；空值由引擎自己的通用兜底填格。
        currentSituation: '',
        protagonistGoal: '',
        enemyAdvantage: '',
      }),
    )
  }

  const handleCopy = async (sol: SparkSolution) => {
    await clipboardWriter.writeText(`【${sol.operatorName}】\n${sol.concretePlot}`)
    setCopiedId(sol.operatorId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="h-full flex flex-col bg-[var(--ink-bg-panel)] text-[var(--ink-text)] overflow-y-auto p-4 space-y-4 text-xs">
      <div className="flex items-center justify-between border-b border-[var(--ink-border)] pb-2">
        <span className="font-semibold text-sm flex items-center gap-1.5 text-amber-500">
          <Lightbulb className="w-4 h-4" /> 写作卡文破局炉
        </span>
        <span className="text-[10px] text-[var(--ink-text-muted)]">
          {excerpt ? '选段可用' : '未选中正文'}
        </span>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] text-[var(--ink-text-muted)] block">当前困境极性切换：</label>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { id: 'dead_end', label: '必死绝境' },
            { id: 'moral_dilemma', label: '两难抉择' },
            { id: 'identity_leak', label: '身份暴雷' },
            { id: 'clue_fracture', label: '逻辑断线' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setDilemmaType(item.id as DilemmaType)}
              className={`p-1.5 rounded text-center transition ${
                dilemmaType === item.id
                  ? 'bg-amber-500 text-white font-semibold'
                  : 'bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-[var(--ink-text-muted)]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button
          onClick={handleRun}
          className="w-full py-1.5 rounded bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 transition"
        >
          <Sparkles className="w-3.5 h-3.5" /> 按当前选段推演
        </button>
      </div>

      <div className="space-y-2">
        <span className="text-[11px] font-semibold text-amber-500 block">
          应急破局脑洞方案（前3项推荐）：
        </span>
        {notice ? (
          <div className="p-2.5 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-canvas)] text-[var(--ink-text-muted)] text-[11px]">
            {notice}
          </div>
        ) : solutions.length === 0 ? (
          <div className="p-2.5 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-canvas)] text-[var(--ink-text-muted)] text-[11px]">
            未推演：点上方「按当前选段推演」才开始，这里不预置方案
          </div>
        ) : (
          <>
            <p className="text-[10px] text-[var(--ink-text-muted)]">
              仅以你选中的正文末段为困境输入；局面、目标、敌方优势三项本抽屉未填，文案里的通用套话请自行替换。
            </p>
            {solutions.slice(0, 3).map((sol) => (
              <div
                key={sol.operatorId}
                className="p-2.5 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[var(--ink-text)]">{sol.operatorName}</span>
                  <button
                    onClick={() => handleCopy(sol)}
                    className="text-amber-500 hover:text-amber-600 flex items-center gap-1 text-[10px]"
                  >
                    {copiedId === sol.operatorId ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    {copiedId === sol.operatorId ? '已复制' : '复制脑洞'}
                  </button>
                </div>

                <p className="text-[11px] text-[var(--ink-text-muted)] leading-relaxed">
                  {sol.concretePlot}
                </p>

                <div className="text-[10px] text-emerald-500">优势：{sol.pros}</div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
