import { htmlToPlain } from '../../../domain/text'
import { useState, useEffect, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import type { PowerTierSystem, ConsistencyViolation, PresetTierSystem } from '../types'
import { consistencyEngine } from '../engine/ConsistencyEngine'
import { indexedDbPowerTierRepository } from '../../../adapters/indexedDbPowerTierRepository'
import { indexedDbCodexEntityRepository } from '../../../adapters/indexedDbCodexEntityRepository'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import { clock } from '../../../adapters/clock'
import { useOptionalPluginHostContext } from '../../../core/pluginHostContext'
import {
  ShieldAlert,
  Save,
  CheckCircle2,
  Plus,
  Trash2,
  ChevronRight,
  RefreshCw,
  SlidersHorizontal,
  Bot,
  BookOpen,
} from 'lucide-react'

export const ConsistencyMasterView: FC<DesktopPluginViewProps> = ({ projectId }) => {
  const hostContext = useOptionalPluginHostContext()
  const [system, setSystem] = useState<PowerTierSystem>(() => consistencyEngine.getDefaultSystem())
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [chapters, setChapters] = useState<any[]>([])
  const [selectedChapterId, setSelectedChapterId] = useState<string>('all')

  // 巡检区状态
  const [auditText, setAuditText] = useState('')
  const [violations, setViolations] = useState<ConsistencyViolation[]>([])
  const [entityCount, setEntityCount] = useState(0)

  const presets = consistencyEngine.getPresetSystems()

  const loadData = async () => {
    try {
      const [existing, allCodex, allChapters] = await Promise.all([
        indexedDbPowerTierRepository.get(projectId),
        indexedDbCodexEntityRepository.getAll(),
        indexedDbProjectRepository.getChaptersByProject(projectId),
      ])

      if (existing) {
        setSystem(existing)
      } else {
        const def = consistencyEngine.getDefaultSystem()
        def.projectId = projectId
        setSystem(def)
      }

      const projectEntities = allCodex.filter((e) => e.projectId === projectId)
      setEntityCount(projectEntities.length)

      allChapters.sort((a, b) => a.order - b.order)
      setChapters(allChapters)
      if (allChapters.length > 0 && !auditText) {
        const firstChapText = allChapters[0].content || ''
        setAuditText(firstChapText)
      }
    } catch (e) {
      console.error('Failed to load consistency data:', e)
    }
  }

  useEffect(() => {
    loadData()
  }, [projectId])

  const handleSelectChapter = (chapId: string) => {
    setSelectedChapterId(chapId)
    if (chapId === 'all') {
      const allText = chapters.map((c) => htmlToPlain(c.content || '')).join('\n\n')
      setAuditText(allText.slice(0, 15000))
    } else {
      const chap = chapters.find((c) => c.id === chapId)
      setAuditText(chap?.content || '')
    }
  }

  // 真实 AI 深度设定自洽与战力崩坏排查
  const handleAiConsistencyAudit = () => {
    if (!auditText.trim()) return
    const tierList = system.tiers.join(' → ')
    const chap = chapters.find((c) => c.id === selectedChapterId)
    const prompt = `请作为网文设定与战力平衡资深审读专家，对以下章节进行【战力阶梯崩坏与设定吃书】深度审查：
【当前作品战力境界】：${tierList}
【当前核查章节】：${chap ? `第 ${chap.order} 章《${chap.title}》` : '多章聚合正文'}
【待审阅正文】：
${auditText.slice(0, 2500)}

请严格排查并反馈：
1. 战力是否出现无解越级倒错（如主角或反派没有借助任何特定神兵/秘法/禁忌代价，跨大境界秒杀强敌）；
2. 是否存在死者复生、角色性格瞬间突变或吃书矛盾；
3. 给出 2 条战力失衡修复示范（如何合情合理地为越级战斗铺垫代价与借力伏笔）。`

    if (hostContext?.aiAssistant?.prompt) {
      hostContext.aiAssistant.prompt(prompt)
    }
  }

  const handleApplyPreset = (preset: PresetTierSystem) => {
    setSystem({
      projectId,
      systemName: preset.name,
      tiers: [...preset.tiers],
      specialModifiers: [...preset.modifiers],
      updatedAt: clock.now(),
    })
  }

  const handleSaveSystem = async () => {
    const toSave: PowerTierSystem = {
      ...system,
      projectId,
      updatedAt: clock.now(),
    }
    await indexedDbPowerTierRepository.save(toSave)
    setSavedSuccess(true)
    setTimeout(() => setSavedSuccess(false), 2000)
  }

  const handleAddTier = (tierName: string) => {
    if (!tierName.trim() || system.tiers.includes(tierName.trim())) return
    setSystem({
      ...system,
      tiers: [...system.tiers, tierName.trim()],
    })
  }

  const handleDeleteTier = (index: number) => {
    const next = [...system.tiers]
    next.splice(index, 1)
    setSystem({ ...system, tiers: next })
  }

  const handleRunAudit = async () => {
    if (!auditText.trim()) {
      setViolations([])
      return
    }
    const allCodex = await indexedDbCodexEntityRepository.getAll()
    const projectEntities = allCodex.filter((e) => e.projectId === projectId)

    // 提取实体与境界
    const entitiesForPower = projectEntities.map((e) => ({
      name: e.name,
      realm: (e.attributes?.realm as string) || (e.attributes?.境界 as string),
    }))

    // 提取已故角色
    const deceased = projectEntities
      .filter((e) => e.attributes?.status === 'deceased' || e.attributes?.状态 === '已故')
      .map((e) => ({ id: e.id, name: e.name }))

    const powerViolations = consistencyEngine.scanTextForInversions(
      auditText,
      entitiesForPower,
      system,
    )
    const deceasedViolations = consistencyEngine.scanTextForDeceased(auditText, deceased)

    setViolations([...powerViolations, ...deceasedViolations])
  }

  return (
    <div className="h-full flex flex-col bg-[var(--ink-bg-canvas)] text-[var(--ink-text)] overflow-hidden">
      {/* 顶栏 */}
      <div className="border-b border-[var(--ink-border)] bg-[var(--ink-bg-panel)] p-4 shrink-0 flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight">战力阶梯与设定巡检哨兵</h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-500 font-medium">
              偏序 DAG · 越阶失真防护
            </span>
          </div>
          <p className="text-xs text-[var(--ink-text-muted)] mt-0.5">
            构建严格战力阶梯偏序集，实时巡检无解越阶倒错、死者复生硬伤与设定吃书漏洞
          </p>
        </div>

        <button
          onClick={handleSaveSystem}
          className="px-3.5 py-1.5 rounded-lg bg-[var(--ink-accent)] text-white text-xs font-semibold hover:opacity-90 flex items-center gap-1.5 shadow-sm transition-all"
        >
          {savedSuccess ? (
            <CheckCircle2 className="w-3.5 h-3.5" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          <span>{savedSuccess ? '配置已保存' : '保存战力体系'}</span>
        </button>
      </div>

      {/* 主体双栏布局 */}
      <div className="flex-1 flex min-h-0 overflow-hidden divide-x divide-[var(--ink-border)]">
        {/* 左栏：战力阶梯与借力机制配置 */}
        <div className="w-96 flex flex-col bg-[var(--ink-bg-panel)] overflow-y-auto p-4 space-y-4 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--ink-text)] flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" />
              <span>战力阶梯偏序体系</span>
            </span>
            <span className="text-[10px] text-[var(--ink-text-muted)]">
              {system.tiers.length} 个阶层
            </span>
          </div>

          {/* 预置体系快速套用 */}
          <div className="space-y-1.5">
            <label className="text-[11px] text-[var(--ink-text-muted)] block">
              快速套用预置体系：
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              {presets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleApplyPreset(p)}
                  className="text-left px-2.5 py-1.5 rounded-lg bg-[var(--ink-bg-canvas)] hover:bg-[var(--ink-bg-hover)] border border-[var(--ink-border)] text-xs transition-colors flex items-center justify-between group"
                >
                  <span className="font-medium text-[var(--ink-text)]">{p.name}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--ink-text-muted)] group-hover:text-[var(--ink-accent)]" />
                </button>
              ))}
            </div>
          </div>

          {/* 阶梯序列 */}
          <div className="space-y-2">
            <label className="text-[11px] text-[var(--ink-text-muted)] block">
              当前阶梯顺序（从低到高）：
            </label>
            <div className="space-y-1">
              {system.tiers.map((tier, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-xs"
                >
                  <span className="font-semibold text-[var(--ink-text)]">
                    {idx + 1}. {tier}
                  </span>
                  <button
                    onClick={() => handleDeleteTier(idx)}
                    className="text-[var(--ink-text-muted)] hover:text-rose-400 p-0.5"
                    title="删除层级"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* 追加阶梯 */}
            <div className="pt-1 flex items-center gap-1.5">
              <input
                type="text"
                id="new-tier-input"
                placeholder="新层级（如 仙帝）"
                className="flex-1 px-2.5 py-1 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-xs focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddTier((e.target as HTMLInputElement).value)
                    ;(e.target as HTMLInputElement).value = ''
                  }
                }}
              />
              <button
                onClick={() => {
                  const input = document.getElementById('new-tier-input') as HTMLInputElement
                  if (input) {
                    handleAddTier(input.value)
                    input.value = ''
                  }
                }}
                className="px-2.5 py-1 rounded bg-[var(--ink-bg-elevated)] hover:bg-[var(--ink-bg-hover)] text-xs border border-[var(--ink-border)] flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> 添加
              </button>
            </div>
          </div>

          {/* 越阶缓冲词库 */}
          <div className="space-y-1.5 pt-2 border-t border-[var(--ink-border)]">
            <label className="text-[11px] text-[var(--ink-text-muted)] block">
              越阶合理借力缓冲词库（出现则视为合理越阶）：
            </label>
            <div className="flex flex-wrap gap-1">
              {system.specialModifiers.map((mod, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-[10px] text-[var(--ink-text-muted)]"
                >
                  {mod}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 右栏：全篇自洽巡检大厅 */}
        <div className="flex-1 flex flex-col bg-[var(--ink-bg-canvas)] overflow-hidden">
          <div className="p-4 border-b border-[var(--ink-border)] bg-[var(--ink-bg-panel)] flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-[var(--ink-text)]">设定一致性扫描仪</span>
              <span className="text-[var(--ink-text-muted)]">
                · 已绑定世界观实体: {entityCount} 个
              </span>
            </div>
            <div className="flex items-center gap-2">
              {chapters.length > 0 && (
                <div className="flex items-center gap-1 text-xs text-[var(--ink-text-muted)]">
                  <BookOpen className="w-3.5 h-3.5" />
                  <select
                    value={selectedChapterId}
                    onChange={(e) => handleSelectChapter(e.target.value)}
                    className="px-2 py-1 text-xs rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-[var(--ink-text)]"
                  >
                    <option value="all">全书章节采样</option>
                    {chapters.map((c) => (
                      <option key={c.id} value={c.id}>
                        第 {c.order} 章 · {c.title || '无题'}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <button
                onClick={handleRunAudit}
                className="px-3 py-1 rounded-lg bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] hover:border-[var(--ink-accent)] text-xs font-medium flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> 立即巡检
              </button>
              {hostContext?.aiAssistant?.isAvailable && (
                <button
                  onClick={handleAiConsistencyAudit}
                  className="px-3 py-1 rounded-lg bg-[var(--ink-accent)] text-white text-xs font-medium hover:opacity-90 flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  <Bot className="w-3.5 h-3.5" /> AI 战力与设定深度排查
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col p-4 space-y-4 overflow-y-auto">
            <div>
              <label className="text-xs font-medium text-[var(--ink-text)] block mb-1.5">
                粘贴待巡检的战斗/交互章节段落：
              </label>
              <textarea
                rows={5}
                value={auditText}
                onChange={(e) => setAuditText(e.target.value)}
                placeholder="例如：练气期的楚凌霄走上前，突然一拳秒杀了元婴期的赵长老！此时方长老（已故角色）也走上前冷笑..."
                className="w-full p-3 rounded-xl bg-[var(--ink-bg-panel)] border border-[var(--ink-border)] text-xs text-[var(--ink-text)] focus:border-[var(--ink-accent)] focus:outline-none resize-none"
              />
            </div>

            {/* 巡检报告列表 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-[var(--ink-text-muted)]">
                <span>巡检发现的逻辑违规与硬伤：({violations.length})</span>
                {violations.length === 0 && auditText.trim() && (
                  <span className="text-emerald-500 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 设定完全自洽，未发现越阶或吃书矛盾
                  </span>
                )}
              </div>

              {violations.map((v) => (
                <div
                  key={v.id}
                  className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/5 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-rose-500 flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4" />
                      {v.type === 'power_tier_inversion' ? '战力越阶失真' : '死者复生矛盾'}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 font-semibold">
                      高危逻辑硬伤
                    </span>
                  </div>

                  <p className="text-[11px] text-[var(--ink-text)] font-medium">
                    命中违规片段：
                    <span className="font-mono bg-[var(--ink-bg-canvas)] px-1 py-0.5 rounded border border-[var(--ink-border)]">
                      “{v.snippet}”
                    </span>
                  </p>

                  <p className="text-[11px] text-[var(--ink-text-muted)] leading-relaxed">
                    {v.explanation}
                  </p>

                  <p className="text-[11px] text-amber-500/90 pt-1 border-t border-[var(--ink-border)]/40">
                    💡 修复建议：{v.suggestedAction}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
