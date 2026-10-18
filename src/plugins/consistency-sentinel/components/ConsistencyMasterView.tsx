import { semanticTextFromContent } from '../../../domain/content'
import { useState, useEffect, useRef, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import type { PowerTierSystem, ConsistencyViolation, PresetTierSystem } from '../types'
import { consistencyEngine } from '../engine/ConsistencyEngine'
import { indexedDbPowerTierRepository } from '../../../adapters/indexedDbPowerTierRepository'
import { indexedDbCodexEntityRepository } from '../../../adapters/indexedDbCodexEntityRepository'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import { clock } from '../../../adapters/clock'
import { useOptionalPluginHostContext } from '../../../core/pluginHostContext'
import { usePluginAiTask } from '../../../core/usePluginAiTask'
import { PluginAiTaskPanel } from '../../../components/plugins/PluginAiTaskPanel'
import { ScoreProvenanceBadge } from '../../../ui/atoms'
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
import { Tooltip, Select } from '../../../ui/primitives'
import { createProvenance } from '../../../domain/story/provenance'
import {
  projectChapterSequence,
  type PositionedChapter,
} from '../../../domain/chapter/chapterSequence'

export const ConsistencyMasterView: FC<DesktopPluginViewProps> = (props) => (
  <ProjectConsistencyView key={props.projectId} {...props} />
)
const ProjectConsistencyView: FC<DesktopPluginViewProps> = ({ projectId }) => {
  const hostContext = useOptionalPluginHostContext()
  const [system, setSystem] = useState<PowerTierSystem>(() =>
    consistencyEngine.emptySystem(projectId),
  )
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [chapters, setChapters] = useState<PositionedChapter[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [selectedChapterId, setSelectedChapterId] = useState<string>('all')

  // 巡检区状态
  const [auditText, setAuditText] = useState('')
  const [rawViolations, setViolations] = useState<ConsistencyViolation[]>([])
  const identity = JSON.stringify([projectId, auditText, system, selectedChapterId])
  const scopeRef = useRef(identity)
  scopeRef.current = identity
  const [scannedIdentity, setScannedIdentity] = useState<string | null>(null)
  const violations = scannedIdentity === identity ? rawViolations : []
  const aiTask = usePluginAiTask('consistency-sentinel', identity)
  // 「自洽」只能是对某一段已巡检文本的结论，不能是刚打开页面时的默认态。
  const [scannedText, setScannedText] = useState<string | null>(null)
  const [entityCount, setEntityCount] = useState(0)

  const presets = consistencyEngine.getPresetSystems()

  const loadData = async () => {
    try {
      const [existing, allCodex, allChapters, volumes] = await Promise.all([
        indexedDbPowerTierRepository.get(projectId),
        indexedDbCodexEntityRepository.getAll(),
        indexedDbProjectRepository.getChaptersByProject(projectId),
        indexedDbProjectRepository.getVolumesByProject(projectId),
      ])

      if (existing) {
        setSystem(existing)
      } else {
        setSystem(consistencyEngine.emptySystem(projectId))
      }

      const projectEntities = allCodex.filter((e) => e.projectId === projectId)
      setEntityCount(projectEntities.length)

      const orderedChapters = projectChapterSequence(projectId, allChapters, volumes)
      setChapters(orderedChapters)
      if (orderedChapters.length > 0 && !auditText) {
        const firstChapText = semanticTextFromContent(
          orderedChapters[0].id,
          orderedChapters[0].content || '',
          orderedChapters[0].revision,
        )
        setAuditText(firstChapText)
        setSelectedChapterId(orderedChapters[0].id)
      }
    } catch (e) {
      setError('设定或卷章信息读取失败，请重试。')
    }
  }

  useEffect(() => {
    loadData()
  }, [projectId])

  const handleSelectChapter = (chapId: string) => {
    setSelectedChapterId(chapId)
    if (chapId === 'all') {
      const allText = chapters
        .map((c) => semanticTextFromContent(c.id, c.content || '', c.revision))
        .join('\n\n')
      setAuditText(allText)
    } else {
      const chap = chapters.find((c) => c.id === chapId)
      setAuditText(chap ? semanticTextFromContent(chap.id, chap.content || '', chap.revision) : '')
    }
  }

  // AI 深度设定自洽与战力崩坏排查
  const handleAiConsistencyAudit = async () => {
    if (!auditText.trim()) return
    const chap = chapters.find((c) => c.id === selectedChapterId)
    const analysisInput = {
      powerSystem: system,
      chapter: chap
        ? {
            id: chap.id,
            chapterNumber: chap.chapterNumber,
            revision: chap.revision,
            title: chap.title,
          }
        : undefined,
      text: semanticTextFromContent(chap?.id ?? 'manual-audit', auditText, chap?.revision ?? 0),
      authorEntities: (await indexedDbCodexEntityRepository.getAll()).filter(
        (entity) => entity.projectId === projectId,
      ),
    }

    await aiTask.run(analysisInput)
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
    if (saving) return
    const validation = consistencyEngine.validatePowerHierarchy(system)
    if (!validation.isValid) {
      setError(
        [
          ...validation.errors,
          ...validation.cycles.map((cycle) => `关系包含环：${cycle.join(' < ')}`),
        ].join('；'),
      )
      return
    }
    setSaving(true)
    try {
      const toSave: PowerTierSystem = {
        ...system,
        projectId,
        provenance: createProvenance({ sourceType: 'author', factLevel: 'canonical-fact' }),
        updatedAt: clock.now(),
      }
      await indexedDbPowerTierRepository.save(toSave)
      setSavedSuccess(true)
      setError('')
    } catch {
      setError('体系保存失败，请重试。')
    } finally {
      setSaving(false)
    }
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
    const requestedIdentity = identity
    try {
      if (!auditText.trim()) {
        setViolations([])
        setScannedText(null)
        return
      }
      const allCodex = await indexedDbCodexEntityRepository.getAll()
      if (scopeRef.current !== requestedIdentity) return
      const projectEntities = allCodex.filter((e) => e.projectId === projectId)

      // 提取实体与境界
      const entitiesForPower = projectEntities.map((e) => ({
        name: e.name,
        realm: (e.attributes?.realm as string) || (e.attributes?.境界 as string),
      }))

      // 提取已故角色
      const deceased = projectEntities
        .filter((e) => e.attributes?.status === 'deceased' || e.attributes?.状态 === '已故')
        .map((e) => ({
          id: e.id,
          name: e.name,
          deathAtChapter:
            typeof e.attributes?.deathAtChapter === 'number'
              ? e.attributes.deathAtChapter
              : undefined,
        }))

      const powerViolations = consistencyEngine.scanTextForInversions(
        auditText,
        entitiesForPower,
        system,
      )
      const deceasedViolations = consistencyEngine.scanTextForDeceased(
        auditText,
        deceased,
        chapters.find((chapter) => chapter.id === selectedChapterId)?.chapterNumber ?? undefined,
      )

      setViolations([
        ...consistencyEngine.scanPowerHierarchyCycles(system),
        ...powerViolations,
        ...deceasedViolations,
      ])
      setScannedText(auditText)
      setScannedIdentity(requestedIdentity)
      setError('')
    } catch {
      setError('设定读取或巡检失败，请重试。')
    }
  }

  return (
    <div className="h-full flex flex-col bg-[var(--ink-bg-canvas)] text-[var(--ink-text)] overflow-hidden">
      {error && (
        <p role="alert" className="p-2 text-xs text-rose-500">
          {error}
        </p>
      )}
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
            登记作者等级约束，定位战斗和已故角色的字面候选；故事时间与能力例外须另行核对。
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
              {system.tiers.length === 0
                ? '未配置：不替本书选流派'
                : `${system.tiers.length} 个阶层`}
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
          <div className="space-y-1 text-xs">
            <Select
              aria-label="等级顺序"
              value={system.relations === undefined ? 'linear' : 'partial'}
              onValueChange={(value) =>
                setSystem((current) => ({
                  ...current,
                  relations: value === 'linear' ? undefined : [],
                }))
              }
            >
              <option value="linear">按列表从低到高</option>
              <option value="partial">只采用登记关系</option>
            </Select>
            {system.relations !== undefined && (
              <label className="block">
                登记关系（每行：低等级 &lt; 高等级；空白表示不可比）
                <textarea
                  aria-label="登记等级关系"
                  className="w-full border bg-transparent"
                  value={system.relations
                    .map((relation) => `${relation.lowerTier} < ${relation.higherTier}`)
                    .join('\n')}
                  onChange={(event) =>
                    setSystem((current) => ({
                      ...current,
                      relations: event.target.value
                        .split('\n')
                        .filter((line) => line.trim())
                        .map((line) => {
                          const [lower = '', higher = ''] = line.split('<')
                          return { lowerTier: lower.trim(), higherTier: higher.trim() }
                        }),
                    }))
                  }
                />
              </label>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-[11px] text-[var(--ink-text-muted)] block">
              {system.relations === undefined
                ? '当前阶梯顺序（从低到高）：'
                : '已登记等级（排列不表示强弱）：'}
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
                  <Tooltip content="删除层级">
                    <button
                      onClick={() => handleDeleteTier(idx)}
                      className="text-[var(--ink-text-muted)] hover:text-rose-400 p-0.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </Tooltip>
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

          {/* 作者登记的越阶例外词 */}
          <div className="space-y-1.5 pt-2 border-t border-[var(--ink-border)]">
            <label className="text-[11px] text-[var(--ink-text-muted)] block">
              作者登记的越阶例外词（命中仍需核对）：
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
              <ScoreProvenanceBadge source="rule" detail="按阶梯顺序与已故标注做规则匹配" />
            </div>
            <div className="flex items-center gap-2">
              {chapters.length > 0 && (
                <div className="flex items-center gap-1 text-xs text-[var(--ink-text-muted)]">
                  <BookOpen className="w-3.5 h-3.5" />
                  <Select
                    aria-label="筛选章节"
                    value={selectedChapterId}
                    onValueChange={(v) => handleSelectChapter(v)}
                    size="sm"
                  >
                    <option value="all">全书章节采样</option>
                    {chapters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.chapterNumber ? `第 ${c.chapterNumber} 章` : '位置未知'} ·{' '}
                        {c.title || '无题'}
                      </option>
                    ))}
                  </Select>
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
                  disabled={aiTask.isRunning}
                  onClick={handleAiConsistencyAudit}
                  className="px-3 py-1 rounded-lg bg-[var(--ink-accent)] text-white text-xs font-medium hover:opacity-90 flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  <Bot className="w-3.5 h-3.5" /> AI 战力与设定深度排查
                </button>
              )}
              <PluginAiTaskPanel view={aiTask.view} onRetry={aiTask.retry} />
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
                <span>待核对的规则候选：({violations.length})</span>
                {violations.length === 0 && auditText.trim() && scannedText === null && (
                  <span>尚未巡检，点「立即巡检」后才有结论</span>
                )}
                {violations.length === 0 &&
                  auditText.trim() &&
                  scannedText !== null &&
                  scannedText !== auditText && <span>正文已改动，结论已过期</span>}
                {violations.length === 0 &&
                  scannedText === auditText &&
                  scannedIdentity === identity &&
                  auditText.trim() &&
                  system.tiers.length === 0 && (
                    <span className="text-amber-500 font-medium">
                      未套用战力阶梯，本次只巡检死者复生一类问题
                    </span>
                  )}
                {violations.length === 0 &&
                  scannedText === auditText &&
                  scannedIdentity === identity &&
                  auditText.trim() &&
                  system.tiers.length > 0 && (
                    <span className="text-emerald-500 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />{' '}
                      已巡检段落未命中字面候选；完整语义尚未审阅
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
                      待作者确认
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
