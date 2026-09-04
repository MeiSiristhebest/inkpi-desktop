import { useState, useEffect, type FC } from "react"
import type { DesktopPluginViewProps } from "../../../types/plugin"
import { indexedDbSubtextRepository } from "../../../adapters/indexedDbSubtextRepository"
import { SubtextCompilerEngine } from "../engine/SubtextCompilerEngine"
import type { SubtextDialogueRecord } from "../types"
import { MessageSquareQuote, Layers, Send } from "lucide-react"
import { clock } from "../../../adapters/clock"
import { idGenerator } from "../../../adapters/idGenerator"

export const SubtextMasterView: FC<DesktopPluginViewProps> = ({ projectId, onStats }) => {
  const [spoken, setSpoken] = useState("你走吧，我一个人也可以很好。")
  const [speakerName, setSpeakerName] = useState("苏雨柔")
  const [emotion, setEmotion] = useState<"anger" | "fear" | "pride" | "affection" | "jealousy" | "guilt">("affection")
  

  const loadList = async () => {
    await indexedDbSubtextRepository.getAll(projectId)
    }

  useEffect(() => {
    loadList().catch(console.error)
  }, [projectId])

  useEffect(() => {
    onStats?.({
      title: "潜台词与冰山对白双轨编译器",
      wordCount: spoken.length,
      updatedAt: clock.now(),
    })
  }, [spoken, onStats])

  const compiled = SubtextCompilerEngine.compile(spoken, speakerName, emotion)
  const renderedParagraph = SubtextCompilerEngine.renderNovelParagraph(compiled)

  const handleSave = async () => {
    const record: SubtextDialogueRecord = {
      id: idGenerator.generate("subtext"),
      projectId,
      chapterId: "manual",
      speakerName: compiled.speakerName,
      spoken: compiled.spoken,
      subtext: compiled.subtext,
      beatAction: compiled.beatAction,
      defenseMechanism: compiled.defenseMechanism,
      tensionLevel: compiled.tensionLevel,
      updatedAt: clock.now(),
    }
    await indexedDbSubtextRepository.save(record)
    await loadList()
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto text-slate-800 dark:text-slate-100">
      <div className="flex items-center justify-between border-b pb-4 border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <MessageSquareQuote className="w-6 h-6 text-indigo-500" />
            <span>潜台词与冰山对白双轨编译器 (SubtextCompiler)</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            遵循海明威“冰山理论”，将白开水对白解耦为“表面台词 + 水下潜台词 + 肢体微反应”三轨立体架构
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border rounded-xl p-5 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">平淡台词输入</h3>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">说话角色名:</label>
            <input
              className="mt-1 w-full border px-3 py-1.5 rounded bg-white dark:bg-slate-800 text-xs border-slate-300 dark:border-slate-700"
              value={speakerName}
              onChange={(e) => setSpeakerName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">内在隐藏情绪 / 动机:</label>
            <select
              className="mt-1 w-full border px-3 py-1.5 rounded bg-white dark:bg-slate-800 text-xs border-slate-300 dark:border-slate-700"
              value={emotion}
              onChange={(e) => setEmotion(e.target.value as any)}
            >
              <option value="affection">深情克制 / 默默守护</option>
              <option value="fear">恐惧惊惶 / 故作镇静</option>
              <option value="jealousy">嫉恨妒意 / 酸葡萄反语</option>
              <option value="guilt">内疚悔恨 / 狼狈回避</option>
              <option value="pride">自尊傲慢 / 居高临下</option>
              <option value="anger">盛怒克制 / 隐忍杀机</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">嘴上说的表面台词:</label>
            <textarea
              className="mt-1 w-full h-24 p-3 border rounded bg-white dark:bg-slate-800 text-xs border-slate-300 dark:border-slate-700"
              value={spoken}
              onChange={(e) => setSpoken(e.target.value)}
            />
          </div>
          <button
            onClick={handleSave}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded text-xs flex items-center justify-center gap-1.5 transition"
          >
            <Send className="w-4 h-4" /> 归档此三轨对白卡片
          </button>
        </div>

        <div className="border rounded-xl p-5 bg-slate-900 text-slate-100 border-indigo-900 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-indigo-400 flex items-center gap-1.5">
              <Layers className="w-4 h-4" /> 海明威冰山三轨重构视图
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950 border border-indigo-800 text-indigo-300">
              张力指数: {compiled.tensionLevel} / 5
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded bg-slate-800/80 border border-slate-700 space-y-1">
              <div className="text-[10px] text-slate-400 font-bold uppercase">1. 表面台词 (Spoken - 露出水面 1/8)</div>
              <div className="font-semibold text-amber-300">"{compiled.spoken}"</div>
            </div>

            <div className="p-3 rounded bg-slate-800/80 border border-indigo-800/60 space-y-1">
              <div className="text-[10px] text-indigo-400 font-bold uppercase">2. 水下潜台词 (Subtext - 掩藏水下 7/8)</div>
              <div className="font-serif italic text-indigo-200">"{compiled.subtext}"</div>
              <div className="text-[10px] text-slate-400 pt-1">防御机制: {compiled.defenseMechanism}</div>
            </div>

            <div className="p-3 rounded bg-slate-800/80 border border-slate-700 space-y-1">
              <div className="text-[10px] text-emerald-400 font-bold uppercase">3. 伴随肢体微反应 (Beat Action)</div>
              <div className="text-emerald-300">{compiled.beatAction}</div>
            </div>
          </div>

          <div className="pt-2 space-y-1">
            <div className="text-[10px] text-slate-400 font-bold uppercase">成稿小说段落试炼:</div>
            <div className="p-3 rounded bg-slate-950 border border-slate-800 font-serif text-xs text-slate-300 leading-relaxed">
              {renderedParagraph}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
