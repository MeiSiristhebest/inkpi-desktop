import { useState, useEffect, useMemo, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import { RhythmMetronomeEngine } from '../engine/RhythmMetronomeEngine'
import type { RhythmCadenceRecord } from '../../../ports/rhythmCadenceRepository'
import { indexedDbRhythmCadenceRepository } from '../../../adapters/indexedDbRhythmCadenceRepository'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import { clock } from '../../../adapters/clock'
import {
  Activity,
  Zap,
  Layers,
  Compass,
  AlertOctagon,
  CheckCircle,
  Save,
  RotateCcw,
} from 'lucide-react'

export const RhythmMetronomeMasterView: FC<DesktopPluginViewProps> = ({ projectId }) => {
  const [config, setConfig] = useState<RhythmCadenceRecord | null>(null)
  const [chapterCount, setChapterCount] = useState<number>(1)
  const [stagnantInput, setStagnantInput] = useState<number>(0)
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null)

  const loadData = async () => {
    const [existing, allChapters] = await Promise.all([
      indexedDbRhythmCadenceRepository.get(projectId),
      indexedDbProjectRepository.getChaptersByProject(projectId),
    ])

    const total = allChapters.length > 0 ? allChapters.length : 1
    setChapterCount(total)

    if (existing) {
      setConfig(existing)
      setStagnantInput(existing.stagnationChapterCount)
    } else {
      const initial: RhythmCadenceRecord = {
        projectId,
        microCycleLength: RhythmMetronomeEngine.DEFAULT_MICRO_LENGTH,
        mesoCycleLength: RhythmMetronomeEngine.DEFAULT_MESO_LENGTH,
        macroCycleLength: RhythmMetronomeEngine.DEFAULT_MACRO_LENGTH,
        currentMicroStep: ((total - 1) % RhythmMetronomeEngine.DEFAULT_MICRO_LENGTH) + 1,
        currentMesoStep: ((total - 1) % RhythmMetronomeEngine.DEFAULT_MESO_LENGTH) + 1,
        currentMacroStep: ((total - 1) % RhythmMetronomeEngine.DEFAULT_MACRO_LENGTH) + 1,
        stagnationChapterCount: 0,
        autoDetectEnabled: true,
        updatedAt: clock.now(),
      }
      setConfig(initial)
      setStagnantInput(0)
    }
  }

  useEffect(() => {
    loadData()
  }, [projectId])

  const beats = useMemo(() => {
    return RhythmMetronomeEngine.calculateBeats(chapterCount, config || undefined)
  }, [chapterCount, config])

  const stagnationReport = useMemo(() => {
    return RhythmMetronomeEngine.diagnoseStagnation(stagnantInput, [2600, 2400, 2800])
  }, [stagnantInput])

  const handleSaveConfig = async () => {
    if (!config) return
    const updated: RhythmCadenceRecord = {
      ...config,
      stagnationChapterCount: stagnantInput,
      updatedAt: clock.now(),
    }
    await indexedDbRhythmCadenceRepository.save(updated)
    setConfig(updated)
    setSavedSuccessMsg('网文节奏律动参数已成功保存！')
    setTimeout(() => setSavedSuccessMsg(null), 2500)
  }

  const handleResetStagnation = async () => {
    setStagnantInput(0)
    if (config) {
      const updated: RhythmCadenceRecord = {
        ...config,
        stagnationChapterCount: 0,
        updatedAt: clock.now(),
      }
      await indexedDbRhythmCadenceRepository.save(updated)
      setConfig(updated)
    }
  }

  return (
    <div className="p-6 h-full flex flex-col space-y-4 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 overflow-y-auto">
      {/* 顶部标题栏 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b pb-4 border-slate-200 dark:border-slate-800 gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <Activity className="w-6 h-6 text-amber-500" />
            商业网文黄金节拍器与高潮推进节律仪 (Rhythm Metronome)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            黄金 3-15-50 章三层嵌套自驱推进力学模型，杜绝水文烂尾与主线拖沓停滞。
          </p>
        </div>

        <div className="flex items-center gap-2">
          {savedSuccessMsg && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              {savedSuccessMsg}
            </span>
          )}
          <button
            onClick={handleSaveConfig}
            className="px-3.5 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition flex items-center gap-1.5 shadow-sm"
          >
            <Save className="w-4 h-4" /> 保存节律配置
          </button>
        </div>
      </div>

      {/* 节拍健康度与当前章节进度总览 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="text-xs text-slate-400">当前累计章节进度</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            第 {chapterCount} 章
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            实时咬合全书三层推进时钟
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="text-xs text-slate-400">节奏紧凑健康分</div>
          <div
            className={`text-2xl font-black mt-1 ${
              stagnationReport.pacingPacingScore > 70
                ? 'text-emerald-500'
                : stagnationReport.pacingPacingScore > 50
                ? 'text-amber-500'
                : 'text-red-500'
            }`}
          >
            {stagnationReport.pacingPacingScore} / 100
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {stagnationReport.isStagnant ? '检测到主线滞缓' : '剧情高频自驱中'}
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="text-xs text-slate-400">当前微循环阶段</div>
          <div className="text-base font-bold text-amber-500 mt-1">
            {beats.micro.phaseDescription}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            步频: 第 {beats.micro.currentStep} / {beats.micro.totalSteps} 拍
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="text-xs text-slate-400">中循环大副本节律</div>
          <div className="text-base font-bold text-blue-500 mt-1">
            {beats.meso.phaseDescription}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            步频: 第 {beats.meso.currentStep} / {beats.meso.totalSteps} 拍
          </div>
        </div>
      </div>

      {/* 水文停滞预警板 */}
      <div
        className={`p-4 rounded-xl border transition ${
          stagnationReport.isStagnant
            ? 'bg-red-50/40 dark:bg-red-950/30 border-red-300 dark:border-red-800'
            : 'bg-emerald-50/40 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {stagnationReport.isStagnant ? (
              <AlertOctagon className="w-5 h-5 text-red-500" />
            ) : (
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            )}
            <span className="font-bold text-sm text-slate-900 dark:text-white">
              {stagnationReport.diagnostic}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span>连续无推进章数:</span>
            <input
              type="number"
              min={0}
              max={20}
              value={stagnantInput}
              onChange={(e) => setStagnantInput(Number(e.target.value))}
              className="w-14 p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-center font-bold"
            />
            <button
              onClick={handleResetStagnation}
              className="px-2 py-1 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> 重置推进
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-300 mt-2">
          👉 <span className="font-semibold">节律抢救方案：</span>
          {stagnationReport.remedyAction}
        </p>
      </div>

      {/* 三层嵌套黄金循环卡片流 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        {/* 微循环卡片 */}
        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3 flex flex-col">
          <div className="flex items-center justify-between border-b pb-2 border-slate-100 dark:border-slate-700">
            <span className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-500" /> 微循环 (3章起承高潮)
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-600">
              第 {beats.micro.currentStep} / {beats.micro.totalSteps} 拍
            </span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
            <div
              className="bg-amber-500 h-full rounded-full transition-all"
              style={{ width: `${beats.micro.progressPct}%` }}
            />
          </div>
          <div className="space-y-1 text-xs">
            <div className="font-semibold text-slate-800 dark:text-slate-200">
              当前阶段：{beats.micro.phaseDescription}
            </div>
            <div className="text-slate-500 leading-relaxed">
              {beats.micro.recommendedAction}
            </div>
          </div>
          <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-700 text-[11px] text-slate-400">
            设计准则：每 3 篇连载必须出现一次局部战术逆转或打脸兑现。
          </div>
        </div>

        {/* 中循环卡片 */}
        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3 flex flex-col">
          <div className="flex items-center justify-between border-b pb-2 border-slate-100 dark:border-slate-700">
            <span className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-blue-500" /> 中循环 (15章副本闭环)
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-600">
              第 {beats.meso.currentStep} / {beats.meso.totalSteps} 拍
            </span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
            <div
              className="bg-blue-500 h-full rounded-full transition-all"
              style={{ width: `${beats.meso.progressPct}%` }}
            />
          </div>
          <div className="space-y-1 text-xs">
            <div className="font-semibold text-slate-800 dark:text-slate-200">
              当前阶段：{beats.meso.phaseDescription}
            </div>
            <div className="text-slate-500 leading-relaxed">
              {beats.meso.recommendedAction}
            </div>
          </div>
          <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-700 text-[11px] text-slate-400">
            设计准则：每 10-15 章必须彻底打通一个支线或斩杀一名重要反派。
          </div>
        </div>

        {/* 大循环卡片 */}
        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3 flex flex-col">
          <div className="flex items-center justify-between border-b pb-2 border-slate-100 dark:border-slate-700">
            <span className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-purple-500" /> 大循环 (50章整卷宏观更替)
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-purple-500/10 text-purple-600">
              第 {beats.macro.currentStep} / {beats.macro.totalSteps} 拍
            </span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
            <div
              className="bg-purple-500 h-full rounded-full transition-all"
              style={{ width: `${beats.macro.progressPct}%` }}
            />
          </div>
          <div className="space-y-1 text-xs">
            <div className="font-semibold text-slate-800 dark:text-slate-200">
              当前阶段：{beats.macro.phaseDescription}
            </div>
            <div className="text-slate-500 leading-relaxed">
              {beats.macro.recommendedAction}
            </div>
          </div>
          <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-700 text-[11px] text-slate-400">
            设计准则：整卷完结时必须换地图、大升级或重构世界地缘格局。
          </div>
        </div>
      </div>
    </div>
  )
}
