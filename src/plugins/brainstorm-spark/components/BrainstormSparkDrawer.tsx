import { useState, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import { BrainstormSparkEngine } from '../engine/BrainstormSparkEngine'
import type { DilemmaType, SparkSolution } from '../types'
import { clipboardWriter } from '../../../adapters/clipboardWriter'
import { Lightbulb, Copy, Check } from 'lucide-react'

export const BrainstormSparkDrawer: FC<DesktopPluginDrawerProps> = ({ currentText }) => {
  const [dilemmaType, setDilemmaType] = useState<DilemmaType>('dead_end')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const solutions = BrainstormSparkEngine.generateSolutions({
    dilemmaType,
    coreProblem: currentText ? currentText.slice(-60) : '当前主角陷入困境',
    currentSituation: '敌强我弱，危机重重',
    protagonistGoal: '绝处逢生，破局反杀',
    enemyAdvantage: '主场优势与境界压制',
  })

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
          {currentText ? '末尾危机随动' : '常规破局'}
        </span>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] text-[var(--ink-text-muted)] block">
          当前困境极性切换：
        </label>
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
      </div>

      <div className="space-y-2">
        <span className="text-[11px] font-semibold text-amber-500 block">
          应急破局脑洞方案（前3项推荐）：
        </span>
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
                {copiedId === sol.operatorId ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copiedId === sol.operatorId ? '已复制' : '复制脑洞'}
              </button>
            </div>

            <p className="text-[11px] text-[var(--ink-text-muted)] leading-relaxed">
              {sol.concretePlot}
            </p>

            <div className="text-[10px] text-emerald-500">
              优势：{sol.pros}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
