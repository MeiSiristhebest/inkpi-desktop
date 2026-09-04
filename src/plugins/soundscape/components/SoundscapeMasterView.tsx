import { useState, useEffect, type FC } from "react"
import type { DesktopPluginViewProps } from "../../../types/plugin"
import { indexedDbSoundscapeConfigRepository } from "../../../adapters/indexedDbSoundscapeConfigRepository"
import { AudioSynthesizerEngine } from "../engine/AudioSynthesizerEngine"
import type { MechanicalSwitchType, AmbienceType, SoundscapeConfigRecord } from "../types"
import { Headphones, Volume2, VolumeX, CloudRain, Flame, Music, Sparkles } from "lucide-react"
import { clock } from "../../../adapters/clock"

export const SoundscapeMasterView: FC<DesktopPluginViewProps> = ({ projectId, onStats }) => {
  const [synth] = useState(() => new AudioSynthesizerEngine())
  const [switchType, setSwitchType] = useState<MechanicalSwitchType>("blue")
  const [ambience, setAmbience] = useState<AmbienceType>("rain")
  const [volumeKey, setVolumeKey] = useState(0.6)
  const [volumeAmbience, setVolumeAmbience] = useState(0.4)
  const [enabled, setEnabled] = useState(true)
  const [isAmbiencePlaying, setIsAmbiencePlaying] = useState(false)

  useEffect(() => {
    indexedDbSoundscapeConfigRepository.get(projectId).then((cfg) => {
      if (cfg) {
        setSwitchType(cfg.switchType)
        setAmbience(cfg.backgroundAmbience)
        setVolumeKey(cfg.volumeKey)
        setVolumeAmbience(cfg.volumeAmbience)
        setEnabled(cfg.enabled)
      }
    }).catch(console.error)
  }, [projectId])

  useEffect(() => {
    onStats?.({
      title: "键盘声学与白噪音伴奏",
      wordCount: 0,
      updatedAt: clock.now(),
    })
  }, [onStats])

  const saveConfig = async (
    nextSwitch = switchType,
    nextAmb = ambience,
    nextVKey = volumeKey,
    nextVAmb = volumeAmbience,
    nextEn = enabled
  ) => {
    const record: SoundscapeConfigRecord = {
      projectId,
      switchType: nextSwitch,
      backgroundAmbience: nextAmb,
      volumeKey: nextVKey,
      volumeAmbience: nextVAmb,
      enabled: nextEn,
    }
    await indexedDbSoundscapeConfigRepository.save(record)
  }

  const toggleAmbience = () => {
    if (isAmbiencePlaying) {
      synth.stopAmbience()
      setIsAmbiencePlaying(false)
    } else {
      synth.startAmbience(ambience, volumeAmbience)
      setIsAmbiencePlaying(true)
    }
  }

  const handleTestKey = () => {
    synth.triggerKeyPress(switchType, volumeKey)
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto text-slate-800 dark:text-slate-100">
      <div className="flex items-center justify-between border-b pb-4 border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Headphones className="w-6 h-6 text-indigo-500" />
            <span>机械键盘声学与白噪音伴奏 (Soundscape)</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            纯 Web Audio API 物理声学建模，零音频文件依赖，高保真还原青轴/茶轴/打字机触感并伴奏沉浸白噪音
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const next = !enabled
              setEnabled(next)
              saveConfig(switchType, ambience, volumeKey, volumeAmbience, next)
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
              enabled ? "bg-indigo-600 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-500"
            }`}
          >
            {enabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            {enabled ? "声学系统已开启" : "声学系统已静音"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 左侧：机械轴发声设定 */}
        <div className="border rounded-xl p-5 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-4">
          <h3 className="text-sm font-bold flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <Sparkles className="w-4 h-4" /> 机械键盘轴体物理仿真
          </h3>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">选择轴体音效:</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "blue", name: "清脆青轴 (Clicky)", desc: "高频瞬态冲击与金属簧片共鸣" },
                { id: "brown", name: "微段落茶轴 (Tactile)", desc: "温润段落感，无刺耳高音" },
                { id: "vintage", name: "古典打字机 (Vintage)", desc: "厚重机簧反弹与深沉腔体" },
                { id: "silent", name: "静音红轴 (Silent)", desc: "极轻微阻尼轻叩" },
              ].map((s) => (
                <div
                  key={s.id}
                  onClick={() => {
                    setSwitchType(s.id as any)
                    saveConfig(s.id as any)
                    synth.triggerKeyPress(s.id as any, volumeKey)
                  }}
                  className={`p-3 rounded-lg border cursor-pointer transition text-xs ${
                    switchType === s.id
                      ? "bg-white dark:bg-slate-800 border-indigo-500 shadow-sm"
                      : "bg-transparent border-slate-300 dark:border-slate-800 opacity-60 hover:opacity-100"
                  }`}
                >
                  <div className="font-bold">{s.name}</div>
                  <div className="text-[11px] text-slate-500 mt-1">{s.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs font-semibold">
              <span>按键音量:</span>
              <span>{Math.round(volumeKey * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              className="w-full"
              value={volumeKey}
              onChange={(e) => {
                const v = Number(e.target.value)
                setVolumeKey(v)
                saveConfig(switchType, ambience, v, volumeAmbience, enabled)
              }}
            />
          </div>

          <button
            onClick={handleTestKey}
            className="w-full py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded text-xs font-bold transition"
          >
            试听当前击键物理音效 (Click)
          </button>
        </div>

        {/* 右侧：白噪音发生器 */}
        <div className="border rounded-xl p-5 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-4">
          <h3 className="text-sm font-bold flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <Music className="w-4 h-4" /> 沉浸式环境白噪音
          </h3>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">选择伴奏氛围:</label>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {[
                { id: "rain", name: "窗外暴雨", icon: CloudRain },
                { id: "campfire", name: "壁炉炭火", icon: Flame },
                { id: "temple", name: "古刹木鱼", icon: Music },
              ].map((amb) => {
                const Icon = amb.icon
                return (
                  <div
                    key={amb.id}
                    onClick={() => {
                      setAmbience(amb.id as any)
                      saveConfig(switchType, amb.id as any)
                      if (isAmbiencePlaying) {
                        synth.startAmbience(amb.id as any, volumeAmbience)
                      }
                    }}
                    className={`p-3 rounded-lg border text-center cursor-pointer transition ${
                      ambience === amb.id
                        ? "bg-white dark:bg-slate-800 border-indigo-500 shadow-sm"
                        : "bg-transparent border-slate-300 dark:border-slate-800 opacity-60"
                    }`}
                  >
                    <Icon className="w-5 h-5 mx-auto mb-1 text-indigo-500" />
                    <div className="font-bold">{amb.name}</div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs font-semibold">
              <span>环境音量:</span>
              <span>{Math.round(volumeAmbience * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              className="w-full"
              value={volumeAmbience}
              onChange={(e) => {
                const v = Number(e.target.value)
                setVolumeAmbience(v)
                saveConfig(switchType, ambience, volumeKey, v, enabled)
                if (isAmbiencePlaying) {
                  synth.startAmbience(ambience, v)
                }
              }}
            />
          </div>

          <button
            onClick={toggleAmbience}
            className={`w-full py-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
              isAmbiencePlaying
                ? "bg-rose-600 hover:bg-rose-700 text-white"
                : "bg-indigo-600 hover:bg-indigo-700 text-white"
            }`}
          >
            {isAmbiencePlaying ? "停止播放白噪音" : "开始播放背景白噪音"}
          </button>
        </div>
      </div>
    </div>
  )
}
