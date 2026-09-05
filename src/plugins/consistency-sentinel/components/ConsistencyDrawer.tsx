import { useState, useEffect, useMemo, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import type { PowerTierSystem, ConsistencyViolation } from '../types'
import { consistencyEngine } from '../engine/ConsistencyEngine'
import { indexedDbPowerTierRepository } from '../../../adapters/indexedDbPowerTierRepository'
import { indexedDbCodexEntityRepository } from '../../../adapters/indexedDbCodexEntityRepository'
import { clock } from '../../../adapters/clock'
import { pluginEventBus } from '../../../core/pluginEventBus'
import { ShieldAlert, CheckCircle2 } from 'lucide-react'

export const ConsistencyDrawer: FC<DesktopPluginDrawerProps> = ({ projectId, currentText }) => {
  const [system, setSystem] = useState<PowerTierSystem>(() => consistencyEngine.getDefaultSystem())
  const [entities, setEntities] = useState<
    { name: string; realm?: string; isDeceased?: boolean }[]
  >([])
  const [externalBreaches, setExternalBreaches] = useState<ConsistencyViolation[]>([])

  // 订阅系统 EventBus 的 POWER_BREACH_DETECTED 事件（来自 combat-sandbox）
  useEffect(() => {
    const unsub = pluginEventBus.on('POWER_BREACH_DETECTED', (payload) => {
      if (payload.projectId !== projectId) return
      setExternalBreaches((prev) => {
        const id = `breach-${payload.protagonistName}-${payload.enemyName}-${clock.now()}`
        if (
          prev.some(
            (b) =>
              b.snippet.includes(payload.protagonistName) && b.snippet.includes(payload.enemyName),
          )
        ) {
          return prev
        }
        return [
          {
            id,
            type: 'power_tier_inversion',
            severity: payload.riskLevel === 'CRITICAL_COLLAPSE' ? 'critical' : 'warning',
            snippet: `${payload.protagonistName} vs ${payload.enemyName} (阶差: ${payload.tierDiff})`,
            explanation: `[战力沙盘预警] ${payload.diagnostic}`,
            suggestedAction:
              '请在沙盘中补全对等代偿资产（如仙宝大阵、天劫反噬等），或降低敌方战力能级。',
          },
          ...prev,
        ]
      })
    })

    return () => {
      unsub()
    }
  }, [projectId])

  useEffect(() => {
    indexedDbPowerTierRepository
      .get(projectId)
      .then((sys) => {
        if (sys) setSystem(sys)
      })
      .catch(() => {})

    indexedDbCodexEntityRepository
      .getAll()
      .then((all) => {
        const filtered = all.filter((e) => e.projectId === projectId)
        setEntities(
          filtered.map((e) => ({
            name: e.name,
            realm: (e.attributes?.realm as string) || (e.attributes?.境界 as string),
            isDeceased: e.attributes?.status === 'deceased' || e.attributes?.状态 === '已故',
          })),
        )
      })
      .catch(() => {})
  }, [projectId])

  const violations: ConsistencyViolation[] = useMemo(() => {
    if (!currentText || currentText.trim().length < 5) return []

    const powerEntities = entities.filter((e) => e.realm)
    const deceasedEntities = entities
      .filter((e) => e.isDeceased)
      .map((e) => ({ id: e.name, name: e.name }))

    const pViolations = consistencyEngine.scanTextForInversions(currentText, powerEntities, system)
    const dViolations = consistencyEngine.scanTextForDeceased(currentText, deceasedEntities)

    return [...pViolations, ...dViolations, ...externalBreaches]
  }, [currentText, entities, system, externalBreaches])

  return (
    <aside
      className="w-72 h-full flex flex-col bg-[var(--ink-bg-panel)] border-l border-[var(--ink-border)] text-[var(--ink-text)] text-xs"
      data-testid="consistency-drawer"
    >
      {/* 顶部感知状态栏 */}
      <div className="p-3 border-b border-[var(--ink-border)] bg-[var(--ink-bg-elevated)]/40 shrink-0 space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-semibold text-[var(--ink-text)]">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
            <span>设定自洽哨兵</span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-[var(--ink-text-muted)]">
            体系: {system.tiers.length} 阶
          </span>
        </div>

        {violations.length > 0 ? (
          <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 space-y-0.5">
            <div className="font-semibold text-[11px] flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              <span>发现 {violations.length} 处潜在逻辑吃书！</span>
            </div>
          </div>
        ) : (
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center gap-1 text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>当前章节战力与设定自洽</span>
          </div>
        )}
      </div>

      {/* 违规列表 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {violations.length === 0 ? (
          <div className="text-center py-10 text-[var(--ink-text-muted)] text-[11px]">
            正文中未检测到越阶倒错或死者复活等逻辑硬伤。
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
