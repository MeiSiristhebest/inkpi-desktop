import { useState, useEffect, useMemo, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import type { PowerTierSystem, ConsistencyViolation } from '../types'
import { consistencyEngine } from '../engine/ConsistencyEngine'
import { indexedDbPowerTierRepository } from '../../../adapters/indexedDbPowerTierRepository'
import { indexedDbCodexEntityRepository } from '../../../adapters/indexedDbCodexEntityRepository'
import { indexedDbCombatSandboxRepository } from '../../../adapters/indexedDbCombatSandboxRepository'
import { pluginEventBus } from '../../../core/pluginEventBus'
import type { PluginEventPayloads } from '../../../core/pluginEventBus'
import type { CombatDuelRecord } from '../../../ports/combatSandboxRepository'
import { ScoreProvenanceBadge } from '../../../ui/atoms'
import { ShieldAlert, CheckCircle2 } from 'lucide-react'

type CombatWarning = PluginEventPayloads['POWER_BREACH_DETECTED']

function savedCombatWarnings(
  records: readonly CombatDuelRecord[],
  projectId: string,
): CombatWarning[] {
  return records.flatMap((record) => {
    const audit = record.breachAudit
    if (
      !record.id ||
      record.projectId !== projectId ||
      typeof record.protagonistName !== 'string' ||
      !record.protagonistName.trim() ||
      typeof record.enemyName !== 'string' ||
      !record.enemyName.trim() ||
      audit?.isBreached !== true ||
      audit.status !== 'conflict' ||
      (audit.source !== 'author-constraint-review' && audit.source !== 'resource-budget') ||
      (audit.riskLevel !== 'WARNING' && audit.riskLevel !== 'CRITICAL_COLLAPSE') ||
      !Number.isFinite(audit.tierDifference)
    ) {
      return []
    }

    return [
      {
        recordId: record.id,
        projectId: record.projectId,
        protagonistName: record.protagonistName,
        enemyName: record.enemyName,
        tierDiff: audit.tierDifference,
        riskLevel: audit.riskLevel,
        diagnostic:
          typeof audit.diagnostic === 'string' && audit.diagnostic.trim()
            ? audit.diagnostic
            : '已保存记录未提供诊断文本。',
      },
    ]
  })
}

export const ConsistencyDrawer: FC<DesktopPluginDrawerProps> = (props) => (
  <ProjectConsistencyDrawer key={props.projectId} {...props} />
)
const ProjectConsistencyDrawer: FC<DesktopPluginDrawerProps> = ({
  projectId,
  currentText,
  currentChapterNumber,
}) => {
  const [system, setSystem] = useState<PowerTierSystem>(() =>
    consistencyEngine.emptySystem(projectId),
  )
  const [entities, setEntities] = useState<
    { name: string; realm?: string; isDeceased?: boolean; deathAtChapter?: number }[]
  >([])
  const [externalBreaches, setExternalBreaches] = useState<CombatWarning[]>([])
  const [combatWarningError, setCombatWarningError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')

  // 订阅系统 EventBus 的 POWER_BREACH_DETECTED 事件（来自 combat-sandbox）
  useEffect(() => {
    const unsub = pluginEventBus.on('POWER_BREACH_DETECTED', (payload) => {
      if (payload.projectId !== projectId) return
      setExternalBreaches((prev) => [
        payload,
        ...prev.filter((breach) => breach.recordId !== payload.recordId),
      ])
    })

    return () => {
      unsub()
    }
  }, [projectId])

  useEffect(() => {
    let disposed = false
    let latestLoad = 0
    const loadSavedBreaches = async () => {
      const loadId = ++latestLoad
      try {
        const records = await indexedDbCombatSandboxRepository.getAll(projectId)
        if (disposed || loadId !== latestLoad) return
        setExternalBreaches(savedCombatWarnings(records, projectId))
        setCombatWarningError('')
      } catch {
        if (!disposed && loadId === latestLoad) {
          setCombatWarningError('已保存的沙盘预警读取失败，结果可能不完整。')
        }
      }
    }

    void loadSavedBreaches()
    const unsubscribe = pluginEventBus
      .scopedBus(projectId)
      .on('COMBAT_DUEL_SAVED', () => void loadSavedBreaches())

    return () => {
      disposed = true
      unsubscribe()
    }
  }, [projectId])

  useEffect(() => {
    let disposed = false
    const load = async () => {
      try {
        const [sys, all] = await Promise.all([
          indexedDbPowerTierRepository.get(projectId),
          indexedDbCodexEntityRepository.getAll(),
        ])
        if (disposed) return
        setSystem(sys ?? consistencyEngine.emptySystem(projectId))
        const filtered = all.filter((e) => e.projectId === projectId)
        setEntities(
          filtered.map((e) => ({
            name: e.name,
            realm: (e.attributes?.realm as string) || (e.attributes?.境界 as string),
            isDeceased: e.attributes?.status === 'deceased' || e.attributes?.状态 === '已故',
            deathAtChapter:
              typeof e.attributes?.deathAtChapter === 'number'
                ? e.attributes.deathAtChapter
                : undefined,
          })),
        )
        setLoaded(true)
        setError('')
      } catch {
        if (!disposed) setError('设定读取失败，请重试。')
      }
    }
    load()
    const unsubscribe = pluginEventBus.scopedBus(projectId).on('CODEX_ENTITY_TOUCHED', load)
    return () => {
      disposed = true
      unsubscribe()
    }
  }, [projectId])

  const violations: ConsistencyViolation[] = useMemo(() => {
    if (!loaded || !currentText.trim()) return []

    const powerEntities = entities.filter((e) => e.realm)
    const deceasedEntities = entities
      .filter((e) => e.isDeceased)
      .map((e) => ({ id: e.name, name: e.name, deathAtChapter: e.deathAtChapter }))

    const pViolations = consistencyEngine.scanTextForInversions(currentText, powerEntities, system)
    const dViolations = consistencyEngine.scanTextForDeceased(
      currentText,
      deceasedEntities,
      currentChapterNumber ?? undefined,
    )

    return [...consistencyEngine.scanPowerHierarchyCycles(system), ...pViolations, ...dViolations]
  }, [currentText, currentChapterNumber, entities, system, loaded])

  return (
    <aside
      className="w-72 h-full flex flex-col bg-[var(--ink-bg-panel)] border-l border-[var(--ink-border)] text-[var(--ink-text)] text-xs"
      data-testid="consistency-drawer"
    >
      {error && (
        <p role="alert" className="p-2">
          {error}
        </p>
      )}
      {combatWarningError && (
        <p role="alert" className="p-2">
          {combatWarningError}
        </p>
      )}
      {/* 顶部感知状态栏 */}
      <div className="p-3 border-b border-[var(--ink-border)] bg-[var(--ink-bg-elevated)]/40 shrink-0 space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-semibold text-[var(--ink-text)]">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
            <span>设定自洽哨兵</span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-[var(--ink-text-muted)]">
            {system.tiers.length === 0 ? '未配置阶梯' : `体系: ${system.tiers.length} 阶`}
          </span>
        </div>

        <ScoreProvenanceBadge source="rule" detail="对当前正文跑规则匹配" />

        {violations.length > 0 ? (
          <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 space-y-0.5">
            <div className="font-semibold text-[11px] flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              <span>待核对 {violations.length} 处候选或登记约束</span>
            </div>
          </div>
        ) : !loaded ? (
          <p>正在读取设定</p>
        ) : system.tiers.length === 0 ? (
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center gap-1 text-[11px]">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            <span>未套用战力阶梯，越阶倒错无法判定</span>
          </div>
        ) : !currentText.trim() ? (
          <div className="p-2 rounded-lg bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-[var(--ink-text-muted)] flex items-center gap-1 text-[11px]">
            <span>等待正文，随动巡检尚未开始</span>
          </div>
        ) : (
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center gap-1 text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>未命中字面候选；完整语义尚未审阅</span>
          </div>
        )}
      </div>

      {/* 违规列表 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {externalBreaches.length > 0 && (
          <section className="p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2">
            <div className="font-semibold text-[11px] text-amber-600 dark:text-amber-400">
              已存档的沙盘预警（未绑定章节）
            </div>
            <p className="text-[10px] text-[var(--ink-text-muted)] leading-relaxed">
              来自已保存的战力沙盘记录，可在重新打开面板后恢复。当前视图没有章节、段落或修订出处，不代表当前正文包含同一场对决。
            </p>
            {externalBreaches.map((breach) => (
              <div
                key={breach.recordId}
                className="rounded bg-[var(--ink-bg-canvas)] p-2 space-y-1"
              >
                <p className="font-medium text-[var(--ink-text)]">
                  {breach.protagonistName} vs {breach.enemyName} · 阶差 {breach.tierDiff}
                </p>
                <p className="text-[10px] text-[var(--ink-text-muted)]">{breach.diagnostic}</p>
              </div>
            ))}
          </section>
        )}
        {violations.length === 0 ? (
          <div className="text-center py-10 text-[var(--ink-text-muted)] text-[11px]">
            {system.tiers.length === 0
              ? '未套用战力阶梯，这里只巡检已标注为已故的角色。'
              : '未命中字面候选；故事时间与完整语义尚未审阅。'}
          </div>
        ) : (
          violations.map((v) => (
            <div
              key={v.id}
              className="p-2.5 rounded-xl border border-rose-500/30 bg-rose-500/5 space-y-1.5"
            >
              <div className="flex items-center justify-between text-[11px] font-bold text-rose-500">
                <span>{v.type === 'power_tier_inversion' ? '越阶战力失真' : '死者复生矛盾'}</span>
                <span className="text-[9px] px-1 py-0.2 rounded bg-rose-500/20 font-normal">
                  警告
                </span>
              </div>
              <p className="text-[10px] font-mono bg-[var(--ink-bg-canvas)] p-1 rounded border border-[var(--ink-border)] line-clamp-1 text-[var(--ink-text)]">
                “{v.snippet}”
              </p>
              <p className="text-[10px] text-[var(--ink-text-muted)] leading-relaxed">
                {v.explanation}
              </p>
            </div>
          ))
        )}
      </div>
    </aside>
  )
}
