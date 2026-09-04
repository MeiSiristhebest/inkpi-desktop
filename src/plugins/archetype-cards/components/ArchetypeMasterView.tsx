import { useState, useEffect, type FC } from "react"
import type { DesktopPluginViewProps } from "../../../types/plugin"
import { ArchetypeEngine } from "../engine/ArchetypeEngine"
import type { NarrativeArchetypeRecord, ArchetypeCategory, ChemistryResult } from "../types"
import { Dna, Shuffle, Users, Swords } from "lucide-react"
import { clock } from "../../../adapters/clock"

export const ArchetypeMasterView: FC<DesktopPluginViewProps> = ({ onStats }) => {
  const [engine] = useState(() => new ArchetypeEngine())
  const [category, setCategory] = useState<ArchetypeCategory>("character_archetype_36")
  const [drawnCards, setDrawnCards] = useState<NarrativeArchetypeRecord[]>([])
  const [chemistry, setChemistry] = useState<ChemistryResult | null>(null)

  useEffect(() => {
    onStats?.({
      title: "人格原型与母题卡牌",
      wordCount: 0,
      updatedAt: clock.now(),
    })
  }, [onStats])

  const handleDraw = () => {
    const cards = engine.drawCards(category, 2)
    setDrawnCards(cards)
    if (cards.length >= 2) {
      const chem = ArchetypeEngine.calculateChemistry(cards[0], cards[1])
      setChemistry(chem)
    } else {
      setChemistry(null)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto text-slate-800 dark:text-slate-100">
      <div className="flex items-center justify-between border-b pb-4 border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Dna className="w-6 h-6 text-indigo-500" />
            <span>人格原型素材库与叙事母题卡牌 (ArchetypeCards)</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            收录 36 经典戏剧人格原型、MBTI 16 极性张力对与 12 大英雄之旅母题，一键抽取注入对手戏戏剧张力
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="border px-3 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
            value={category}
            onChange={(e) => setCategory(e.target.value as any)}
          >
            <option value="character_archetype_36">36 经典戏剧人格原型卡</option>
            <option value="narrative_motif_12">12 大英雄之旅叙事母题卡</option>
          </select>
          <button
            onClick={handleDraw}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition"
          >
            <Shuffle className="w-3.5 h-3.5" /> 随机抽取双卡对垒
          </button>
        </div>
      </div>

      {drawnCards.length === 0 ? (
        <div className="py-16 border rounded-2xl text-center text-slate-400 text-xs bg-slate-50 dark:bg-slate-900 border-dashed border-slate-300 dark:border-slate-800 space-y-2">
          <Users className="w-8 h-8 mx-auto text-slate-400 opacity-50" />
          <div>点击右上角「随机抽取双卡对垒」，生成两位极性角色原型并自动测算对手戏冲突火花</div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {drawnCards.map((card, idx) => (
              <div
                key={card.id}
                className="p-5 border rounded-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-3 shadow-sm relative overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-indigo-500 font-bold uppercase tracking-wider">
                    原型卡片 #{idx + 1}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                    {card.category}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{card.name}</h3>

                <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <div><span className="text-slate-400 font-semibold">核心渴望:</span> {card.coreDesire}</div>
                  <div><span className="text-rose-500 font-semibold">阿喀琉斯之踵:</span> {card.fatalFlaw}</div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
                  <div className="text-[11px] text-slate-400 font-semibold">典型行为模式:</div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {card.typicalBehaviors.map((b, bIdx) => (
                      <span key={bIdx} className="px-2 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {chemistry && (
            <div className="p-5 border rounded-2xl bg-slate-900 text-slate-100 border-amber-900/60 space-y-3 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-1.5 text-amber-400 text-sm">
                  <Swords className="w-4 h-4" /> 对手戏化学反应与火花阻抗
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 font-bold text-xs border border-amber-800">
                  戏剧张力指数: {Math.round(chemistry.tensionScore * 100)}%
                </span>
              </div>

              <div className="text-xs text-slate-300">
                <span className="font-bold text-slate-400">核心伦理冲突:</span> {chemistry.coreEthicalConflict}
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-amber-200 font-serif leading-relaxed">
                💡 {chemistry.dramaticPrompt}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
