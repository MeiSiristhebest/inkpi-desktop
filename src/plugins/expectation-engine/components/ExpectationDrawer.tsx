import { useState, useEffect, useMemo, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import type { ExpectationContract } from '../types'
import { expectationEngine } from '../engine/ExpectationEngine'
import { indexedDbExpectationRepository } from '../../../adapters/indexedDbExpectationRepository'
import { Sparkles, AlertTriangle, CheckCircle2, Flame } from 'lucide-react'

export const ExpectationDrawer: FC<DesktopPluginDrawerProps> = ({
  projectId,
  currentText,
}) => {
  const [contracts, setContracts] = useState<ExpectationContract[]>([])

  useEffect(() => {
    indexedDbExpectationRepository.getAll().then((all) => {
      setContracts(all.filter((c) => !c.projectId || c.projectId === projectId))
    }).catch(() => {})
  }, [projectId])

  const rhythm = useMemo(() => {
    return expectationEngine.evaluateChapterText(currentText || '', 1)
  }, [currentText])

  const activeContracts = useMemo(() => {
    return contracts.filter((c) => c.status !== 'fulfilled' && c.status !== 'broken').slice(0, 4)
  }, [contracts])

  return (
    <aside
      className="w-72 h-full flex flex-col bg-[var(--ink-bg-panel)] border-l border-[var(--ink-border)] text-[var(--ink-text)] text-xs"
      data-testid="expectation-drawer"
    >
      {/* 顶部指标感知栏 */}
      <div className="p-3 border-b border-[var(--ink-border)] bg-[var(--ink-bg-elevated)]/40 shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-semibold text-[var(--ink-text)]">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>期待感与节奏监测</span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-[var(--ink-text-muted)]">
            SPR: {rhythm.spr}
          </span>
        </div>

        {/* 压抑与爆发对比条 */}
        <div className="p-2 rounded-lg bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-blue-400">打压蓄势: {rhythm.suppressionSum}</span>
            <span className="text-emerald-500">爽点爆发: {rhythm.payoffSum}</span>
          </div>

          <div className="w-full h-1.5 bg-[var(--ink-bg-elevated)] rounded-full overflow-hidden flex">
            <div
              style={{
                width: `${
                  rhythm.suppressionSum + rhythm.payoffSum === 0
                    ? 50
                    : (rhythm.suppressionSum / (rhythm.suppressionSum + rhythm.payoffSum)) * 100
                }%`,
              }}
              className="h-full bg-blue-400 transition-all duration-300"
            />
            <div
              style={{
                width: `${
                  rhythm.suppressionSum + rhythm.payoffSum === 0
                    ? 50
                    : (rhythm.payoffSum / (rhythm.suppressionSum + rhythm.payoffSum)) * 100
                }%`,
              }}
              className="h-full bg-emerald-500 transition-all duration-300"
            />
          </div>

          {/* 风险提示 */}
          {rhythm.riskLevel === 'suppression_heavy' && (
            <div className="flex items-center gap-1 text-[10px] text-rose-500 font-medium pt-0.5">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              <span>当前段落压抑过重，请注意伏笔反转契机！</span>
            </div>
          )}
          {rhythm.riskLevel === 'fatigue_slap' && (
            <div className="flex items-center gap-1 text-[10px] text-amber-500 font-medium pt-0.5">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              <span>爽点过密无阻力，警惕审美疲劳与通胀！</span>
            </div>
          )}
          {rhythm.riskLevel === 'healthy' && (
            <div className="flex items-center gap-1 text-[10px] text-emerald-500 font-medium pt-0.5">
              <CheckCircle2 className="w-3 h-3 shrink-0" />
              <span>节奏平稳，张力与反击平衡。</span>
            </div>
          )}
        </div>
      </div>

      {/* 待兑现爽点契约一览 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <div className="text-[11px] font-semibold text-[var(--ink-text-muted)] flex items-center justify-between">
          <span>待兑现爽点契约</span>
          <span className="text-[10px] opacity-70">({activeContracts.length})</span>
        </div>

        {activeContracts.length === 0 ? (
          <div className="text-center py-8 text-[var(--ink-text-muted)] text-[11px]">
            暂无未决契约，可在主视口登记！
          </div>
        ) : (
          activeContracts.map((c) => (
            <div
              key={c.id}
              className="p-2.5 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-canvas)] space-y-1.5"
            >
              <div className="flex items-start justify-between gap-1">
                <span className="font-semibold text-xs text-[var(--ink-text)] leading-snug">
                  {c.title}
                </span>
                <span className="text-[10px] text-amber-500 shrink-0">
                  <Flame className="w-3 h-3 inline mr-0.5" />
                  {c.intensity}★
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-[var(--ink-text-muted)]">
                <span>第 {c.plantedChapter} 章埋设</span>
                <span className="text-[var(--ink-accent)]">预期第 {c.promisedResolveChapter} 章兑现</span>
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  )
}
