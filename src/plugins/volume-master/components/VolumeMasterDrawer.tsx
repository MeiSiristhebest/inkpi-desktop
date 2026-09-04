import { useState, useEffect, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import type { VolumeArcRecord, VolumeStat } from '../types'
import { volumeMasterEngine } from '../engine/VolumeMasterEngine'
import { indexedDbVolumeArcRepository } from '../../../adapters/indexedDbVolumeArcRepository'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import { Compass } from 'lucide-react'

export const VolumeMasterDrawer: FC<DesktopPluginDrawerProps> = ({ projectId }) => {
  const [activeVolume, setActiveVolume] = useState<{ id: string; title: string; order: number } | null>(null)
  const [arc, setArc] = useState<VolumeArcRecord | null>(null)
  const [stat, setStat] = useState<VolumeStat | null>(null)

  const loadData = async () => {
    try {
      const [vols, chaps, arcs] = await Promise.all([
        indexedDbProjectRepository.getVolumesByProject(projectId),
        indexedDbProjectRepository.getChaptersByProject(projectId),
        indexedDbVolumeArcRepository.getAll(projectId),
      ])

      if (vols && vols.length > 0) {
        const firstVol = vols[0]
        setActiveVolume(firstVol)
        const matchingArc = (arcs || []).find((a) => a.volumeId === firstVol.id) || null
        setArc(matchingArc)
        setStat(volumeMasterEngine.calculateVolumeStat(firstVol, chaps || [], matchingArc || undefined))
      }
    } catch (e) {
      console.error('Failed to load volume drawer data:', e)
    }
  }

  useEffect(() => {
    loadData()
  }, [projectId])

  if (!activeVolume || !stat) {
    return (
      <div className="p-4 text-xs text-[var(--ink-text-muted)] text-center">
        未检测到已建立分卷。
      </div>
    )
  }

  const actInfo = volumeMasterEngine.getActStageInfo(stat.currentAct)

  return (
    <div className="h-full flex flex-col bg-[var(--ink-bg-panel)] text-[var(--ink-text)] overflow-y-auto p-4 space-y-4 text-xs">
      <div className="flex items-center justify-between border-b border-[var(--ink-border)] pb-3">
        <div className="flex items-center gap-1.5 font-semibold">
          <Compass className="w-4 h-4 text-purple-400" />
          <span>分卷宏观罗盘</span>
        </div>
        <span className="text-[10px] text-[var(--ink-text-muted)]">
          {activeVolume.title}
        </span>
      </div>

      {/* 字数燃烧率仪表 */}
      <div className="p-3 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-canvas)] space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[var(--ink-text-muted)]">分卷字数预算</span>
          <span className="font-bold text-purple-400">{stat.burnRate}%</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-[var(--ink-bg-elevated)] overflow-hidden">
          <div
            className={`h-full rounded-full ${
              stat.status === 'lagging_water' ? 'bg-rose-500' : 'bg-purple-500'
            }`}
            style={{ width: `${Math.min(100, stat.burnRate)}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] text-[var(--ink-text-muted)]">
          <span>已写 {stat.actualWordCount.toLocaleString()} 字</span>
          <span>目标 {stat.targetWordCount.toLocaleString()} 字</span>
        </div>
      </div>

      {/* 当前戏剧阶段 */}
      <div className="p-3 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] space-y-1.5">
        <div className="flex items-center justify-between font-semibold">
          <span className="text-purple-400">{actInfo.label}</span>
          <span className="text-[10px] text-[var(--ink-text-muted)]">{actInfo.progressRange}</span>
        </div>
        <p className="text-[11px] text-[var(--ink-text-muted)] leading-relaxed">
          {actInfo.desc}
        </p>
      </div>

      {/* 核心冲突与卷高潮锚点 */}
      {arc && (
        <div className="space-y-2 pt-2 border-t border-[var(--ink-border)]">
          {arc.coreConflict && (
            <div className="p-2 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)]/50 space-y-0.5">
              <span className="text-[10px] text-[var(--ink-text-muted)] block">本卷核心矛盾</span>
              <p className="text-[11px] text-[var(--ink-text)]">{arc.coreConflict}</p>
            </div>
          )}
          {arc.climaxNode && (
            <div className="p-2 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)]/50 space-y-0.5">
              <span className="text-[10px] text-[var(--ink-text-muted)] block">卷巅峰大高潮</span>
              <p className="text-[11px] text-amber-500">{arc.climaxNode}</p>
            </div>
          )}
          {stat.arcRegression && (
            <div className="p-2 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)]/50 flex items-center justify-between text-[10px] text-[var(--ink-text-muted)]">
              <span>叙事弧回归度</span>
              <span className="text-purple-400 font-mono">R² = {stat.arcRegression.r2}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
