import { useState, type FC } from "react"
import type { DesktopPluginDrawerProps } from "../../../types/plugin"
import { ArchetypeEngine } from "../engine/ArchetypeEngine"
import type { NarrativeArchetypeRecord } from "../types"
import { Dna, Shuffle } from "lucide-react"

export const ArchetypeDrawer: FC<DesktopPluginDrawerProps> = () => {
  const [engine] = useState(() => new ArchetypeEngine())
  const [drawn, setDrawn] = useState<NarrativeArchetypeRecord | null>(null)

  const handleDrawOne = () => {
    const cards = engine.drawCards("character_archetype_36", 1)
    if (cards.length > 0) setDrawn(cards[0])
  }

  return (
    <div className="p-3 space-y-3 text-xs">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <span className="font-bold flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
          <Dna className="w-4 h-4" /> 人格原型灵感卡
        </span>
        <button
          onClick={handleDrawOne}
          className="text-slate-500 hover:text-indigo-600 flex items-center gap-1"
        >
          <Shuffle className="w-3 h-3" /> 抽卡
        </button>
      </div>

      {!drawn ? (
        <div className="p-3 rounded bg-slate-50 dark:bg-slate-800/50 text-slate-400 text-center">
          卡文时点击右上角抽卡，获取戏剧动机灵感
        </div>
      ) : (
        <div className="p-2.5 rounded-lg border bg-white dark:bg-slate-800 space-y-1.5">
          <div className="font-bold text-indigo-600 dark:text-indigo-400 text-sm">
            {drawn.name}
          </div>
          <div className="text-[11px] text-slate-600 dark:text-slate-300">
            核心渴望: {drawn.coreDesire}
          </div>
          <div className="text-[10px] text-rose-500">
            致命弱点: {drawn.fatalFlaw}
          </div>
        </div>
      )}
    </div>
  )
}
