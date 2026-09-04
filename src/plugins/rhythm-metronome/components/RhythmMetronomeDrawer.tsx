import { useState, useEffect, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import { RhythmMetronomeEngine } from '../engine/RhythmMetronomeEngine'
import type { RhythmCadenceRecord } from '../../../ports/rhythmCadenceRepository'
import { indexedDbRhythmCadenceRepository } from '../../../adapters/indexedDbRhythmCadenceRepository'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import { Activity, Zap, Layers, AlertTriangle, CheckCircle2 } from 'lucide-react'

export const RhythmMetronomeDrawer: FC<DesktopPluginDrawerProps> = ({ projectId, currentText }) => {
  const [config, setConfig] = useState<RhythmCadenceRecord | null>(null)
  const [chapterCount, setChapterCount] = useState<number>(1)

  const loadData = async () => {
    const [existing, allChapters] = await Promise.all([
      indexedDbRhythmCadenceRepository.get(projectId),
      indexedDbProjectRepository.getChaptersByProject(projectId),
    ])
    setChapterCount(allChapters.length > 0 ? allChapters.length : 1)
    if (existing) setConfig(existing)
  }

  useEffect(() => {
    loadData()
  }, [projectId])

  const beats = RhythmMetronomeEngine.calculateBeats(chapterCount, config || undefined)
  const wordCount = currentText ? currentText.trim().length : 0

  return (
    <div className="h-full flex flex-col bg-[var(--ink-bg-panel)] text-[var(--ink-text)] overflow-y-auto p-4 space-y-4 text-xs">
      <div className="flex items-center justify-between border-b border-[var(--ink-border)] pb-2">
        <span className="font-semibold text-sm flex items-center gap-1.5 text-amber-500">
          <Activity className="w-4 h-4" /> 黄金节律随动仪表
        </span>
        <span className="text-[10px] text-[var(--ink-text-muted)]">
          第 {chapterCount} 章 (字数 {wordCount})
        </span>
      </div>

      {/* 微循环卡片 */}
      <div className="p-3 rounded-lg bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-bold text-[11px] flex items-center gap-1 text-amber-500">
            <Zap className="w-3.5 h-3.5" /> 3章微节拍步频
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 font-semibold">
            第 {beats.micro.currentStep} / {beats.micro.totalSteps} 拍
          </span>
        </div>
        <div className="w-full bg-[var(--ink-border)]/50 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-amber-500 h-full rounded-full transition-all"
            style={{ width: `${beats.micro.progressPct}%` }}
          />
        </div>
        <div className="text-[11px] text-[var(--ink-text)] font-medium">
          【{beats.micro.phaseDescription}】
        </div>
        <p className="text-[10px] text-[var(--ink-text-muted)] leading-relaxed">
          {beats.micro.recommendedAction}
        </p>
      </div>

      {/* 中循环卡片 */}
      <div className="p-3 rounded-lg bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-bold text-[11px] flex items-center gap-1 text-blue-500">
            <Layers className="w-3.5 h-3.5" /> 15章中循环副本
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-500 font-semibold">
            第 {beats.meso.currentStep} / {beats.meso.totalSteps} 拍
          </span>
        </div>
        <div className="w-full bg-[var(--ink-border)]/50 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-blue-500 h-full rounded-full transition-all"
            style={{ width: `${beats.meso.progressPct}%` }}
          />
        </div>
        <div className="text-[11px] text-[var(--ink-text)] font-medium">
          【{beats.meso.phaseDescription}】
        </div>
        <p className="text-[10px] text-[var(--ink-text-muted)] leading-relaxed">
          {beats.meso.recommendedAction}
        </p>
      </div>

      {/* 写作台字数与密度提醒 */}
      <div className="p-2.5 rounded-lg border border-[var(--ink-border)]/60 bg-[var(--ink-bg-panel)] flex items-center gap-2">
        {wordCount < 1800 ? (
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
        ) : (
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
        )}
        <div className="text-[10px] text-[var(--ink-text-muted)]">
          {wordCount < 1800
            ? '当前章节字数较少，建议单章体量保持在 2200-3000 字以承载足够爽点密度。'
            : '单章篇幅饱满，适合承载起承转合与断章钩子。'}
        </div>
      </div>
    </div>
  )
}
