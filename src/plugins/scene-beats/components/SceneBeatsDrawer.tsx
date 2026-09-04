import { useState, useEffect, useMemo, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import type { ChapterBeatPlan } from '../types'
import { sceneBeatsEngine } from '../engine/SceneBeatsEngine'
import { indexedDbSceneBeatRepository } from '../../../adapters/indexedDbSceneBeatRepository'
import { clock } from '../../../adapters/clock'
import { idGenerator } from '../../../adapters/idGenerator'
import { ListChecks, CheckCircle2, Circle } from 'lucide-react'

export const SceneBeatsDrawer: FC<DesktopPluginDrawerProps> = ({
  projectId,
  currentText,
}) => {
  const [plans, setPlans] = useState<ChapterBeatPlan[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)

  const wordCount = useMemo(
    () => (currentText ? currentText.replace(/\s+/g, '').length : 0),
    [currentText],
  )

  const loadPlans = async () => {
    try {
      const all = await indexedDbSceneBeatRepository.getAll()
      const projectPlans = all.filter((p) => p.projectId === projectId)
      setPlans(projectPlans)
      if (projectPlans.length > 0 && !selectedPlanId) {
        setSelectedPlanId(projectPlans[0].id)
      }
    } catch (e) {
      console.error('Failed to load scene beats in drawer:', e)
    }
  }

  useEffect(() => {
    loadPlans()
  }, [projectId])

  const currentPlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) || plans[0],
    [plans, selectedPlanId],
  )

  // 进度计算
  const pacingReport = useMemo(() => {
    if (!currentPlan || !currentPlan.beats) return null
    return sceneBeatsEngine.calculatePacingStatus(currentPlan, wordCount)
  }, [currentPlan, wordCount])

  const handleToggleComplete = async (beatId: string) => {
    if (!currentPlan) return
    const updatedBeats = currentPlan.beats.map((b) =>
      b.id === beatId ? { ...b, isCompleted: !b.isCompleted } : b,
    )
    const updated: ChapterBeatPlan = {
      ...currentPlan,
      beats: updatedBeats,
      updatedAt: clock.now(),
    }
    await indexedDbSceneBeatRepository.save(updated)
    await loadPlans()
  }

  const handleInitDefaultPlan = async () => {
    const now = clock.now()
    const beats = sceneBeatsEngine.generatePresetPlan('climax_burst', 'ch-current')
    const newPlan: ChapterBeatPlan = {
      id: idGenerator.generate('plan'),
      projectId,
      chapterId: '本章细纲',
      targetWordCount: 3000,
      beats,
      createdAt: now,
      updatedAt: now,
    }
    await indexedDbSceneBeatRepository.save(newPlan)
    await loadPlans()
  }

  return (
    <aside
      className="w-72 h-full flex flex-col bg-[var(--ink-bg-panel)] border-l border-[var(--ink-border)] text-[var(--ink-text)] text-xs"
      data-testid="scene-beats-drawer"
    >
      <div className="p-3 border-b border-[var(--ink-border)] bg-[var(--ink-bg-elevated)]/40 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 font-semibold text-[var(--ink-text)]">
            <ListChecks className="w-3.5 h-3.5 text-blue-500" />
            <span>细纲节拍随动</span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-[var(--ink-text-muted)]">
            {wordCount} 字 / 目标 {currentPlan?.targetWordCount || 3000}
          </span>
        </div>

        {/* 进度条 */}
        {pacingReport && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-[var(--ink-text-muted)]">
              <span>进度达成</span>
              <span className="font-semibold text-[var(--ink-accent)]">
                {pacingReport.progressPct}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-[var(--ink-bg-canvas)] rounded-full overflow-hidden">
              <div
                style={{ width: `${Math.min(100, pacingReport.progressPct)}%` }}
                className="h-full bg-[var(--ink-accent)] rounded-full transition-all duration-300"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {!currentPlan ? (
          <div className="text-center py-10 text-[var(--ink-text-muted)]">
            <p className="mb-2 text-xs">当前章节暂无绑定的细纲节拍</p>
            <button
              onClick={handleInitDefaultPlan}
              className="px-3 py-1.5 rounded-lg bg-[var(--ink-accent)] text-white text-xs font-medium hover:opacity-90"
            >
              生成四段式高潮节拍
            </button>
          </div>
        ) : (
          pacingReport?.beatProgresses.map(({ beat, startWord, endWord }, i) => {
            const isActive = pacingReport.activeBeatIndex === i
            return (
              <div
                key={beat.id}
                className={`p-2.5 rounded-xl border transition-all ${
                  isActive
                    ? 'border-[var(--ink-accent)] bg-[var(--ink-accent)]/10 shadow-xs'
                    : beat.isCompleted
                      ? 'border-emerald-500/30 bg-emerald-500/5 opacity-75'
                      : 'border-[var(--ink-border)] bg-[var(--ink-bg-canvas)]'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1.5 truncate">
                    <button
                      onClick={() => handleToggleComplete(beat.id)}
                      className="text-[var(--ink-text-muted)] hover:text-emerald-500"
                      title={beat.isCompleted ? '标记未完成' : '标记已达成'}
                    >
                      {beat.isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 shrink-0" />
                      )}
                    </button>
                    <span
                      className={`font-semibold truncate text-xs ${
                        beat.isCompleted
                          ? 'line-through text-[var(--ink-text-muted)]'
                          : 'text-[var(--ink-text)]'
                      }`}
                    >
                      {i + 1}. {beat.title}
                    </span>
                  </div>

                  {isActive && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-[var(--ink-accent)] text-white shrink-0 font-medium">
                      当前戏
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-[var(--ink-text-muted)] line-clamp-2 leading-relaxed">
                  {beat.goalOrConflict}
                </p>

                <div className="flex items-center justify-between text-[10px] text-[var(--ink-text-faint)] pt-1.5 border-t border-[var(--ink-border)]/40 mt-1.5">
                  <span>
                    预计 {startWord}~{endWord} 字
                  </span>
                  <span>
                    情绪：{beat.emotionalIn > 0 ? `+${beat.emotionalIn}` : beat.emotionalIn} →{' '}
                    {beat.emotionalOut > 0 ? `+${beat.emotionalOut}` : beat.emotionalOut}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </aside>
  )
}
