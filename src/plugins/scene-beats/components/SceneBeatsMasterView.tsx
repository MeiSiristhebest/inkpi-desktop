import { useState, useEffect, useMemo, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import type { ChapterBeatPlan, SceneBeatItem } from '../types'
import { sceneBeatsEngine } from '../engine/SceneBeatsEngine'
import { indexedDbSceneBeatRepository } from '../../../adapters/indexedDbSceneBeatRepository'
import { clock } from '../../../adapters/clock'
import { idGenerator } from '../../../adapters/idGenerator'
import {
  ListChecks,
  Plus,
  Sparkles,
  Zap,
  AlertCircle,
  CheckCircle2,
  Trash2,
  TrendingUp,
} from 'lucide-react'

export const SceneBeatsMasterView: FC<DesktopPluginViewProps> = ({ projectId }) => {
  const [plans, setPlans] = useState<ChapterBeatPlan[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadPlans = async () => {
    try {
      setLoading(true)
      const all = await indexedDbSceneBeatRepository.getAll()
      const projectPlans = all.filter((p) => !p.projectId || p.projectId === projectId)
      setPlans(projectPlans)
      if (projectPlans.length > 0 && !selectedPlanId) {
        setSelectedPlanId(projectPlans[0].id)
      }
    } catch (e) {
      console.error('Failed to load scene beat plans:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPlans()
  }, [projectId])

  const currentPlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) || plans[0],
    [plans, selectedPlanId],
  )

  const handleCreatePlanFromTemplate = async (
    templateId: 'climax_burst' | 'investigation' | 'transition',
    chapterId: string = `ch-${plans.length + 1}`,
  ) => {
    const now = clock.now()
    const beats = sceneBeatsEngine.generatePresetPlan(templateId, chapterId)
    const newPlan: ChapterBeatPlan = {
      id: idGenerator.generate('plan'),
      projectId,
      chapterId,
      targetWordCount: 3000,
      beats,
      createdAt: now,
      updatedAt: now,
    }
    await indexedDbSceneBeatRepository.save(newPlan)
    await loadPlans()
    setSelectedPlanId(newPlan.id)
  }

  const handleUpdateBeats = async (updatedBeats: SceneBeatItem[]) => {
    if (!currentPlan) return
    const updated: ChapterBeatPlan = {
      ...currentPlan,
      beats: updatedBeats,
      updatedAt: clock.now(),
    }
    await indexedDbSceneBeatRepository.save(updated)
    await loadPlans()
  }

  const handleAddBeat = async () => {
    if (!currentPlan) return
    const newBeat: SceneBeatItem = {
      id: idGenerator.generate('beat'),
      chapterId: currentPlan.chapterId,
      order: currentPlan.beats.length,
      beatType: 'conflict',
      title: '新节拍场景',
      goalOrConflict: '双方发生剧烈冲突',
      budgetWordRatio: 0.25,
      emotionalIn: 0,
      emotionalOut: -0.5,
      isCompleted: false,
    }
    await handleUpdateBeats([...currentPlan.beats, newBeat])
  }

  const handleDeleteBeat = async (beatId: string) => {
    if (!currentPlan) return
    const nextBeats = currentPlan.beats
      .filter((b) => b.id !== beatId)
      .map((b, idx) => ({ ...b, order: idx }))
    await handleUpdateBeats(nextBeats)
  }

  const handleDeletePlan = async (planId: string) => {
    await indexedDbSceneBeatRepository.delete(planId)
    setSelectedPlanId(null)
    await loadPlans()
  }

  // 戏剧张力势能评估
  const arcAnalysis = useMemo(() => {
    if (!currentPlan || !currentPlan.beats) return { totalVoltageDelta: 0, isStagnant: true, curve: [] }
    return sceneBeatsEngine.evaluateDramaticArc(currentPlan.beats)
  }, [currentPlan])

  return (
    <div className="h-full flex flex-col bg-[var(--ink-bg-canvas)] text-[var(--ink-text)] overflow-hidden">
      {/* 顶栏 */}
      <div className="border-b border-[var(--ink-border)] bg-[var(--ink-bg-panel)] p-4 shrink-0 flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight">细纲节拍导演器</h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--ink-accent)]/15 text-[var(--ink-accent)] font-medium">
              Save the Cat · 戏剧电容
            </span>
          </div>
          <p className="text-xs text-[var(--ink-text-muted)] mt-0.5">
            微观单章 3~5 场戏戏剧弧，目标/冲突/高潮四段式与字数预算动态映射
          </p>
        </div>

        {/* 预置模板快速新建 */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleCreatePlanFromTemplate('climax_burst')}
            className="px-3 py-1.5 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] hover:bg-[var(--ink-bg-hover)] text-xs flex items-center gap-1.5"
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" /> 决战高潮模板
          </button>
          <button
            onClick={() => handleCreatePlanFromTemplate('investigation')}
            className="px-3 py-1.5 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] hover:bg-[var(--ink-bg-hover)] text-xs flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-400" /> 悬疑探秘模板
          </button>
          <button
            onClick={() => handleCreatePlanFromTemplate('transition')}
            className="px-3 py-1.5 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] hover:bg-[var(--ink-bg-hover)] text-xs flex items-center gap-1.5"
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> 沉淀过渡模板
          </button>
        </div>
      </div>

      {/* 主体区 */}
      <div className="flex-1 flex min-h-0 overflow-hidden divide-x divide-[var(--ink-border)]">
        {/* 左侧：章节计划列表 */}
        <div className="w-64 flex flex-col bg-[var(--ink-bg-panel)] overflow-hidden shrink-0">
          <div className="p-3 border-b border-[var(--ink-border)] text-xs font-semibold flex items-center justify-between text-[var(--ink-text-muted)]">
            <span>章节细纲列表 ({plans.length})</span>
            <button
              onClick={() => handleCreatePlanFromTemplate('climax_burst')}
              className="hover:text-[var(--ink-accent)]"
              title="新建细纲计划"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {plans.map((p, idx) => {
              const isSelected = p.id === (currentPlan?.id ?? '')
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPlanId(p.id)}
                  className={`group p-2.5 rounded-lg text-xs cursor-pointer flex items-center justify-between transition-colors ${
                    isSelected
                      ? 'bg-[var(--ink-accent)]/10 text-[var(--ink-accent)] border border-[var(--ink-accent)]/30 font-semibold'
                      : 'hover:bg-[var(--ink-bg-hover)] text-[var(--ink-text)]'
                  }`}
                >
                  <div className="truncate">
                    <span className="opacity-60 mr-1">#{idx + 1}</span>
                    <span>{p.chapterId || `第 ${idx + 1} 章细纲`}</span>
                    <span className="text-[10px] text-[var(--ink-text-faint)] ml-2 block">
                      {p.beats?.length || 0} 个节拍 · 目标 {p.targetWordCount} 字
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeletePlan(p.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-400"
                    title="删除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* 右侧：当前章节细纲详情与节拍编辑器 */}
        <div className="flex-1 flex flex-col min-w-0 bg-[var(--ink-bg-canvas)] overflow-hidden">
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-xs text-[var(--ink-text-muted)]">
              加载细纲节拍中...
            </div>
          ) : !currentPlan ? (
            <div className="flex-1 flex items-center justify-center p-8 text-center">
              <div className="max-w-md p-8 border border-dashed border-[var(--ink-border)] rounded-2xl bg-[var(--ink-bg-panel)]">
                <ListChecks className="w-8 h-8 mx-auto text-[var(--ink-accent)] mb-3 opacity-80" />
                <h3 className="font-medium text-sm text-[var(--ink-text)] mb-1">
                  尚无章节细纲计划
                </h3>
                <p className="text-xs text-[var(--ink-text-muted)] mb-4">
                  点击顶栏模板按钮，快速为新章节生成一套起承转合的微观戏剧节拍！
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* 细纲指标分析条 */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)]">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-[11px] text-[var(--ink-text-muted)] block">
                      戏剧势能跨度 (ΔV)
                    </span>
                    <span className="text-lg font-bold text-[var(--ink-accent)]">
                      {arcAnalysis.totalVoltageDelta}
                    </span>
                  </div>
                  <div className="h-8 w-px bg-[var(--ink-border)]" />
                  <div>
                    <span className="text-[11px] text-[var(--ink-text-muted)] block">张力评估</span>
                    {arcAnalysis.isStagnant ? (
                      <span className="text-xs text-amber-500 font-semibold flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> 存在流水账风险
                      </span>
                    ) : (
                      <span className="text-xs text-emerald-500 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> 戏剧弧饱满
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleAddBeat}
                  className="px-3 py-1.5 rounded-lg bg-[var(--ink-accent)] text-white text-xs font-medium hover:opacity-90 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> 追加微节拍
                </button>
              </div>

              {/* 节拍卡片列表 */}
              <div className="space-y-3">
                {currentPlan.beats.map((beat, idx) => {
                  const estWords = Math.round(
                    currentPlan.targetWordCount * (beat.budgetWordRatio || 0.25),
                  )
                  return (
                    <div
                      key={beat.id}
                      className="p-4 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] space-y-3 hover:border-[var(--ink-accent)]/40 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] flex items-center justify-center font-bold text-xs text-[var(--ink-text-muted)]">
                            {idx + 1}
                          </span>
                          <input
                            type="text"
                            value={beat.title}
                            onChange={(e) => {
                              const next = [...currentPlan.beats]
                              next[idx].title = e.target.value
                              handleUpdateBeats(next)
                            }}
                            className="font-semibold text-xs text-[var(--ink-text)] bg-transparent border-b border-transparent focus:border-[var(--ink-accent)] focus:outline-none"
                            placeholder="节拍标题"
                          />
                        </div>

                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-[11px] text-[var(--ink-text-muted)]">
                            建议字数：~{estWords} 字 ({Math.round(beat.budgetWordRatio * 100)}%)
                          </span>
                          <button
                            onClick={() => handleDeleteBeat(beat.id)}
                            className="text-[var(--ink-text-muted)] hover:text-rose-400 p-1"
                            title="删除此节拍"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] text-[var(--ink-text-muted)] mb-1">
                          核心矛盾 / 危机转折细节
                        </label>
                        <textarea
                          rows={2}
                          value={beat.goalOrConflict}
                          onChange={(e) => {
                            const next = [...currentPlan.beats]
                            next[idx].goalOrConflict = e.target.value
                            handleUpdateBeats(next)
                          }}
                          placeholder="描述这场戏的核心人物动机、遭遇的阻力以及结局转折..."
                          className="w-full px-3 py-2 rounded-lg bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-xs text-[var(--ink-text)] focus:outline-none resize-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="block text-[10px] text-[var(--ink-text-muted)] mb-1">
                            入场情绪 (-1.0 绝望 ~ +1.0 狂喜)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="-1"
                            max="1"
                            value={beat.emotionalIn}
                            onChange={(e) => {
                              const next = [...currentPlan.beats]
                              next[idx].emotionalIn = Number(e.target.value)
                              handleUpdateBeats(next)
                            }}
                            className="w-full px-2.5 py-1.5 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-[var(--ink-text)] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-[var(--ink-text-muted)] mb-1">
                            离场情绪 (-1.0 绝望 ~ +1.0 狂喜)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="-1"
                            max="1"
                            value={beat.emotionalOut}
                            onChange={(e) => {
                              const next = [...currentPlan.beats]
                              next[idx].emotionalOut = Number(e.target.value)
                              handleUpdateBeats(next)
                            }}
                            className="w-full px-2.5 py-1.5 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-[var(--ink-text)] focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
