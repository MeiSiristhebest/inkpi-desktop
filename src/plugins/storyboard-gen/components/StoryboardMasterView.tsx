import { useState, useEffect, useRef, type FC } from "react"
import type { DesktopPluginViewProps } from "../../../types/plugin"
import { indexedDbStoryboardRepository } from "../../../adapters/indexedDbStoryboardRepository"
import { StoryboardEngine } from "../engine/StoryboardEngine"
import type { StoryboardSceneRecord, ClimaxStoryboardExtraction } from "../types"
import { Film, Image, Sparkles, Send, Copy, Camera, Check } from "lucide-react"
import { clock } from "../../../adapters/clock"
import { idGenerator } from "../../../adapters/idGenerator"
import { clipboardWriter } from "../../../adapters/clipboardWriter"

const DEFAULT_CHAPTER_CLIMAX = `乌云翻滚，整座演武场狂风大作。
赵家长老狞笑一声，赤焰战刀化作漫天火海朝林凡当头劈落！
林凡不避不闪，深吸一口气，体内的万古修罗诀疯狂运转，双眸爆发出璀璨的金红神芒！
“一剑——断苍穹！”
惊天动地的剑气撕裂了火海，千丈演武石台在一瞬间化作两半！全场陷入死一般的寂静！`

export const StoryboardMasterView: FC<DesktopPluginViewProps> = ({ projectId, onStats }) => {
  const [chapterId, setChapterId] = useState("ch_01")
  const [sceneText, setSceneText] = useState(DEFAULT_CHAPTER_CLIMAX)
  const [scenes, setScenes] = useState<StoryboardSceneRecord[]>([])
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const extracted: ClimaxStoryboardExtraction = StoryboardEngine.extractStoryboard(
    chapterId,
    "第一章 演武反杀",
    sceneText
  )

  const loadScenes = async () => {
    const list = await indexedDbStoryboardRepository.getAll(projectId)
    setScenes(list)
  }

  useEffect(() => {
    loadScenes().catch(console.error)
  }, [projectId])

  useEffect(() => {
    onStats?.({
      title: "角色立绘与分镜生成器",
      wordCount: sceneText.length,
      updatedAt: clock.now(),
    })
  }, [sceneText, onStats])

  // 纯离线 Canvas 绘制电影 16:9 四格分镜与构图辅助线
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)

    // 背景深色底
    ctx.fillStyle = "#090d16"
    ctx.fillRect(0, 0, w, h)

    // 绘制四格布局 (2x2)
    const cols = 2
    const rows = 2
    const pad = 12
    const cellW = (w - pad * 3) / cols
    const cellH = (h - pad * 3) / rows

    extracted.frames.forEach((frame, idx) => {
      const col = idx % cols
      const row = Math.floor(idx / cols)
      const x = pad + col * (cellW + pad)
      const y = pad + row * (cellH + pad)

      // 单格边框
      ctx.fillStyle = "#161e2e"
      ctx.fillRect(x, y, cellW, cellH)

      ctx.strokeStyle = idx === 2 ? "#e11d48" : "#3b82f6"
      ctx.lineWidth = 1.5
      ctx.strokeRect(x, y, cellW, cellH)

      // 构图引导线 (九宫格 / 对角线)
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)"
      ctx.lineWidth = 1
      if (frame.compositionGuide === "rule_of_thirds") {
        ctx.beginPath()
        ctx.moveTo(x + cellW / 3, y)
        ctx.lineTo(x + cellW / 3, y + cellH)
        ctx.moveTo(x + (cellW * 2) / 3, y)
        ctx.lineTo(x + (cellW * 2) / 3, y + cellH)
        ctx.moveTo(x, y + cellH / 3)
        ctx.lineTo(x + cellW, y + cellH / 3)
        ctx.moveTo(x, y + (cellH * 2) / 3)
        ctx.lineTo(x + cellW, y + (cellH * 2) / 3)
        ctx.stroke()
      } else if (frame.compositionGuide === "diagonal_impact") {
        ctx.beginPath()
        ctx.moveTo(x, y + cellH)
        ctx.lineTo(x + cellW, y)
        ctx.stroke()
      }

      // 镜头标题标签
      ctx.fillStyle = "#ffffff"
      ctx.font = "bold 11px sans-serif"
      ctx.fillText(frame.shotLabel, x + 10, y + 20)

      // 光影色调
      ctx.fillStyle = "#94a3b8"
      ctx.font = "10px sans-serif"
      ctx.fillText(`构图: ${frame.compositionGuide} | 光影: ${frame.lightingMood}`, x + 10, y + 36)
    })
  }, [extracted])

  const handleSaveScene = async () => {
    const record: StoryboardSceneRecord = StoryboardEngine.createSceneRecord(
      idGenerator.generate("storyboard"),
      projectId,
      chapterId,
      extracted,
      clock.now()
    )
    await indexedDbStoryboardRepository.save(record)
    await loadScenes()
  }

  const handleCopyPrompt = (prompt: string, id: string) => {
    clipboardWriter.writeText(prompt).catch(() => {})
    setCopiedPromptId(id)
    setTimeout(() => setCopiedPromptId(null), 2000)
  }


  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto text-slate-800 dark:text-slate-100">
      <div className="flex items-center justify-between border-b pb-4 border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Film className="w-6 h-6 text-rose-500" />
            <span>角色立绘与分镜生成器 (StoryboardGen)</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            电影视听“起承转合”四格高潮分镜提炼、九宫格/对角线构图导线绘制与角色立绘 Prompt 编译
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            className="px-3 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
            placeholder="对应章节ID"
            value={chapterId}
            onChange={(e) => setChapterId(e.target.value)}
          />
          <button
            type="button"
            onClick={handleSaveScene}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs rounded-lg font-medium shadow-sm transition"
          >
            <Send className="w-3.5 h-3.5" />
            <span>归档本幕四格分镜</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧：章节名场面高潮输入与四格 Canvas 离线预演 */}
        <div className="space-y-4">
          <div className="border rounded-xl p-5 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 space-y-3">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              高潮名场面文本描述:
            </label>
            <textarea
              className="w-full h-36 p-3 text-xs border rounded font-serif bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-800 leading-relaxed"
              value={sceneText}
              onChange={(e) => setSceneText(e.target.value)}
            />
          </div>

          <div className="border rounded-xl p-5 bg-slate-950 border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-rose-500" />
                <span>离线 16:9 四格电影构图监视器 (Canvas Viewport)</span>
              </span>
              <span className="text-[10px] text-slate-500">九宫格 / 倾斜角导线</span>
            </h3>

            <div className="flex justify-center">
              <canvas
                ref={canvasRef}
                width={540}
                height={300}
                className="rounded-lg shadow-lg border border-slate-800 w-full max-w-full"
              />
            </div>

            {scenes.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-800 text-[11px] text-slate-400">
                <span className="font-bold text-slate-300">已保存分镜档案 ({scenes.length}): </span>
                <span className="text-slate-500">{scenes.map((s) => s.sceneTitle).join("、")}</span>
              </div>
            )}
          </div>
        </div>

        {/* 右侧：四格镜头与角色立绘 Prompt 列表 */}
        <div className="space-y-4">
          <div className="border rounded-xl p-5 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-sm font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-rose-500" />
                <span>电影分镜提示词编译器 (Prompt Matrix)</span>
              </span>
              <span className="text-xs text-slate-400">起 · 承 · 转 · 合</span>
            </h3>

            <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
              {extracted.frames.map((f) => (
                <div
                  key={f.id}
                  className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-rose-600 dark:text-rose-400">
                      {f.shotLabel}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600">
                      {f.shotType}
                    </span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300">{f.description}</p>
                  <div className="p-2 bg-slate-100 dark:bg-slate-950 rounded font-mono text-[10px] text-slate-500 flex justify-between items-center gap-2">
                    <span className="truncate">{f.visualPrompt}</span>
                    <button
                      type="button"
                      onClick={() => handleCopyPrompt(f.visualPrompt, f.id)}
                      className="text-slate-400 hover:text-rose-500 transition shrink-0"
                    >
                      {copiedPromptId === f.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 角色立绘卡生成 */}
          <div className="border rounded-xl p-5 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Image className="w-4 h-4 text-rose-500" />
              <span>本幕角色立绘卡与外观特征</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {extracted.suggestedCharacters.map((c) => (
                <div
                  key={c.characterId}
                  className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs space-y-1.5"
                >
                  <div className="font-bold text-slate-800 dark:text-slate-100">{c.characterName}</div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">{c.visualFeatures}</p>
                  <div className="pt-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleCopyPrompt(c.stableDiffusionPrompt, c.characterId)}
                      className="text-[10px] text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" /> 复制立绘 Prompt
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

