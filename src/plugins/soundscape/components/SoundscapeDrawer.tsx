import { useState, useEffect, type FC } from "react"
import type { DesktopPluginDrawerProps } from "../../../types/plugin"
import { indexedDbSoundscapeConfigRepository } from "../../../adapters/indexedDbSoundscapeConfigRepository"
import { AudioSynthesizerEngine } from "../engine/AudioSynthesizerEngine"
import type { SoundscapeConfigRecord } from "../types"
import { Headphones, Play, Pause } from "lucide-react"

export const SoundscapeDrawer: FC<DesktopPluginDrawerProps> = ({ projectId, currentText }) => {
  const [synth] = useState(() => new AudioSynthesizerEngine())
  const [config, setConfig] = useState<SoundscapeConfigRecord | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    indexedDbSoundscapeConfigRepository.get(projectId).then((cfg) => {
      if (cfg) setConfig(cfg)
    }).catch(console.error)
  }, [projectId])

  // 当正文文本变动时（用户在敲击键），触发轴体音效
  useEffect(() => {
    if (!config || !config.enabled || !currentText) return
    synth.triggerKeyPress(config.switchType, config.volumeKey)
  }, [currentText, config, synth])

  const toggleAmb = () => {
    if (isPlaying) {
      synth.stopAmbience()
      setIsPlaying(false)
    } else {
      synth.startAmbience(config?.backgroundAmbience || "rain", config?.volumeAmbience || 0.4)
      setIsPlaying(true)
    }
  }

  return (
    <div className="p-3 space-y-3 text-xs">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <span className="font-bold flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
          <Headphones className="w-4 h-4" /> 键盘伴奏 HUD
        </span>
        <span className="text-[10px] text-slate-400">
          {config?.switchType.toUpperCase() || "BLUE"} 轴
        </span>
      </div>

      <div className="p-2.5 rounded bg-slate-100 dark:bg-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-slate-500">背景白噪音:</span>
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {config?.backgroundAmbience === "rain" ? "窗外暴雨" : config?.backgroundAmbience === "campfire" ? "壁炉篝火" : "古刹木鱼"}
          </span>
        </div>

        <button
          onClick={toggleAmb}
          className="w-full py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center justify-center gap-1.5 text-xs transition"
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {isPlaying ? "暂停白噪音" : "播放白噪音"}
        </button>
      </div>
    </div>
  )
}
