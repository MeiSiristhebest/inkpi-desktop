import { useState, useEffect, type FC } from "react"
import type { DesktopPluginViewProps } from "../../../types/plugin"
import { indexedDbVoicePreviewRepository } from "../../../adapters/indexedDbVoicePreviewRepository"
import { VoicePreviewEngine } from "../engine/VoicePreviewEngine"
import type { VoiceCastProfileRecord } from "../types"
import { Volume2, Play, Square, Mic, Sliders, Users, Sparkles } from "lucide-react"
import { clock } from "../../../adapters/clock"
import { idGenerator } from "../../../adapters/idGenerator"

const DEFAULT_CHAPTER_TEXT = `林凡冷笑道：“三十年河东，三十年河西，莫欺少年穷！今日退婚之耻，林某记下了。”
赵家长老厉声喝道：“放肆！区区经脉尽断的废人，安敢在老夫面前狂妄自大，给我受死！”
苏清月低声耳语：“林凡哥哥，莫要冲动，先吞服此枚九转还魂丹养好内息。”
林凡大笑道：“哈哈哈哈！何须养伤，老狗，看我一剑破你烈阳神功！”`

export const VoicePreviewMasterView: FC<DesktopPluginViewProps> = ({ projectId, onStats }) => {
  const [chapterText, setChapterText] = useState(DEFAULT_CHAPTER_TEXT)
  const [casts, setCasts] = useState<VoiceCastProfileRecord[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentLineIndex, setCurrentLineIndex] = useState<number | null>(null)

  const script = VoicePreviewEngine.extractScript(chapterText)

  const loadCasts = async () => {
    const list = await indexedDbVoicePreviewRepository.getAll(projectId)
    setCasts(list)
  }

  useEffect(() => {
    loadCasts().catch(console.error)
  }, [projectId])

  useEffect(() => {
    onStats?.({
      title: "角色有声对白试听器",
      wordCount: chapterText.length,
      updatedAt: clock.now(),
    })
  }, [chapterText, onStats])

  const handlePlayLine = (text: string, pitch = 1.0, rate = 1.0) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.pitch = pitch
    utterance.rate = rate
    utterance.lang = "zh-CN"
    window.speechSynthesis.speak(utterance)
  }

  const handlePlayAll = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return
    window.speechSynthesis.cancel()
    setIsPlaying(true)

    let current = 0
    const speakNext = () => {
      if (current >= script.lines.length) {
        setIsPlaying(false)
        setCurrentLineIndex(null)
        return
      }
      const line = script.lines[current]
      setCurrentLineIndex(line.lineIndex)
      const utterance = new SpeechSynthesisUtterance(line.dialogueText)
      utterance.lang = "zh-CN"

      // 匹配角色配置
      const profile = casts.find((c) => c.characterName === line.speakerName)
      utterance.pitch = profile?.pitch || (line.emotion === "angry" ? 1.2 : 1.0)
      utterance.rate = profile?.rate || 1.0

      utterance.onend = () => {
        current++
        speakNext()
      }
      utterance.onerror = () => {
        setIsPlaying(false)
        setCurrentLineIndex(null)
      }
      window.speechSynthesis.speak(utterance)
    }

    speakNext()
  }

  const handleStop = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel()
    }
    setIsPlaying(false)
    setCurrentLineIndex(null)
  }

  const handleAutoAssignVoices = async () => {
    for (const speaker of script.characterSpeakers) {
      const isFemale = /(月|女|雪|儿|妃|姬|师姐|圣女)/.test(speaker)
      const isElder = /(老|祖|宗主|尊|伯|父)/.test(speaker)
      const defaults = VoicePreviewEngine.deriveDefaultProfile(
        speaker,
        isFemale ? "female" : "male",
        isElder ? "elder" : "youth"
      )

      const record: VoiceCastProfileRecord = {
        id: idGenerator.generate("cast"),
        projectId,
        characterId: `char_${speaker}`,
        ...defaults,
        updatedAt: clock.now(),
      }
      await indexedDbVoicePreviewRepository.save(record)
    }
    await loadCasts()
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto text-slate-800 dark:text-slate-100">
      <div className="flex items-center justify-between border-b pb-4 border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Volume2 className="w-6 h-6 text-emerald-500" />
            <span>角色拟真有声对白试听器 (VoicePreview)</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            自动抽取章节对白台本、按角色年龄性格智能分配声线，提供广播剧级拟真连续试听
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAutoAssignVoices}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs rounded-lg font-medium transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>智能推导角色声线</span>
          </button>
          {isPlaying ? (
            <button
              type="button"
              onClick={handleStop}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs rounded-lg font-medium shadow-sm transition"
            >
              <Square className="w-3.5 h-3.5" />
              <span>停止播讲</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePlayAll}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-lg font-medium shadow-sm transition"
            >
              <Play className="w-3.5 h-3.5" />
              <span>整章广播剧播讲 ({script.totalLines}句)</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：正文与台本解析 */}
        <div className="lg:col-span-2 space-y-4">
          <div className="border rounded-xl p-5 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 space-y-3">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              章节对白正文输入区:
            </label>
            <textarea
              className="w-full h-48 p-3 text-xs border rounded font-serif bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-800 leading-relaxed"
              value={chapterText}
              onChange={(e) => setChapterText(e.target.value)}
            />
          </div>

          {/* 实时抽取对白台本音轨 */}
          <div className="border rounded-xl p-5 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 space-y-3">
            <h3 className="text-sm font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-emerald-500" />
                <span>广播剧音轨台本 ({script.lines.length} 句)</span>
              </span>
              <span className="text-xs text-slate-400">已识别人数: {script.characterSpeakers.length}</span>
            </h3>

            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {script.lines.map((line) => (
                <div
                  key={line.lineIndex}
                  className={`p-3 rounded-lg border text-xs flex items-start justify-between gap-3 transition ${
                    currentLineIndex === line.lineIndex
                      ? "bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-400"
                      : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-emerald-700 dark:text-emerald-300">
                        {line.speakerName}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-600">
                        情绪: {line.emotion}
                      </span>
                    </div>
                    <p className="text-slate-800 dark:text-slate-200 font-serif">“{line.dialogueText}”</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handlePlayLine(line.dialogueText)}
                    className="p-1.5 rounded bg-slate-200 dark:bg-slate-800 hover:bg-emerald-500 hover:text-white transition"
                    title="单独试听该句"
                  >
                    <Play className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 右侧：角色配音演员卡配置板 */}
        <div className="border rounded-xl p-5 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 space-y-4">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-500" />
            <span>登场角色声线调音板 ({casts.length})</span>
          </h3>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {casts.length === 0 ? (
              <div className="text-xs text-slate-400 py-12 text-center">
                暂无专属声线配置，点击上方“智能推导角色声线”快速为小说角色生成音色。
              </div>
            ) : (
              casts.map((c) => (
                <div
                  key={c.id}
                  className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs space-y-2"
                >
                  <div className="flex items-center justify-between font-bold">
                    <span>{c.characterName}</span>
                    <span className="text-[10px] text-slate-400">
                      {c.gender === "female" ? "女性" : "男性"} · {c.ageGroup}
                    </span>
                  </div>

                  <div className="space-y-1 text-[11px] text-slate-500">
                    <div className="flex justify-between">
                      <span>音调 (Pitch):</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300">{c.pitch}x</span>
                    </div>
                    <div className="flex justify-between">
                      <span>语速 (Rate):</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300">{c.rate}x</span>
                    </div>
                    <div className="flex justify-between">
                      <span>DSP 滤波模式:</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">{c.timbreFilter}</span>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handlePlayLine(`${c.characterName}声音测试，请多指教。`, c.pitch, c.rate)}
                      className="px-2.5 py-1 text-[10px] bg-slate-200 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white rounded transition flex items-center gap-1"
                    >
                      <Sliders className="w-3 h-3" /> 测试此音色
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

