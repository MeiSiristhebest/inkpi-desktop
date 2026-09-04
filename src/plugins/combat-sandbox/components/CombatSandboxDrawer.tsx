import { useState, useEffect, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import type { CombatDuelRecord } from '../types'
import { indexedDbCombatSandboxRepository } from '../../../adapters/indexedDbCombatSandboxRepository'
import { Swords, ShieldAlert, Zap, Flame, ShieldCheck } from 'lucide-react'

export const CombatSandboxDrawer: FC<DesktopPluginDrawerProps> = ({ projectId, currentText }) => {
  const [duels, setDuels] = useState<CombatDuelRecord[]>([])

  useEffect(() => {
    const load = async () => {
      const all = await indexedDbCombatSandboxRepository.getAll(projectId)
      setDuels(all)
    }
    load()
  }, [projectId])

  const activeDuel = duels.length > 0 ? duels[0] : null

  // 检查正文是否有战斗关键词
  const isCombatScene = currentText
    ? /(交手|斩出|祭出|对轰|轰杀|真罡|本命法宝|剑气如虹|喷出一口精血)/.test(currentText)
    : false

  return (
    <div className="h-full flex flex-col bg-[var(--ink-bg-panel)] text-[var(--ink-text)] overflow-y-auto p-4 space-y-4 text-xs">
      <div className="flex items-center justify-between border-b border-[var(--ink-border)] pb-2">
        <span className="font-semibold text-sm flex items-center gap-1.5 text-amber-500">
          <Swords className="w-4 h-4" /> 战力对招随动感知
        </span>
        <span className="text-[10px] text-[var(--ink-text-muted)]">
          {isCombatScene ? '⚡ 激战中' : '平稳叙事'}
        </span>
      </div>

      {activeDuel ? (
        <div className="space-y-3">
          {/* 对阵双方标牌 */}
          <div className="p-2.5 rounded-lg bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] space-y-2">
            <div className="flex items-center justify-between font-bold text-xs">
              <span className="text-blue-500 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" /> {activeDuel.protagonistName} ({activeDuel.protagonistTier})
              </span>
              <span className="text-stone-400">VS</span>
              <span className="text-rose-500 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5" /> {activeDuel.enemyName} ({activeDuel.enemyTier})
              </span>
            </div>

            <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden flex">
              <div
                className="bg-blue-500 h-full"
                style={{
                  width: `${Math.round(
                    (activeDuel.protagonistRankValue /
                      (activeDuel.protagonistRankValue + activeDuel.enemyRankValue)) *
                      100
                  )}%`,
                }}
              />
              <div
                className="bg-rose-500 h-full"
                style={{
                  width: `${Math.round(
                    (activeDuel.enemyRankValue /
                      (activeDuel.protagonistRankValue + activeDuel.enemyRankValue)) *
                      100
                  )}%`,
                }}
              />
            </div>
          </div>

          {/* 战力崩坏巡检状态 */}
          <div
            className={`p-2.5 rounded-lg border text-[11px] space-y-1 ${
              activeDuel.breachAudit.riskLevel === 'CRITICAL_COLLAPSE'
                ? 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
                : activeDuel.breachAudit.riskLevel === 'WARNING'
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
            }`}
          >
            <div className="font-bold flex items-center gap-1">
              {activeDuel.breachAudit.riskLevel === 'SAFE' ? (
                <ShieldCheck className="w-3.5 h-3.5" />
              ) : (
                <ShieldAlert className="w-3.5 h-3.5" />
              )}
              战力防崩坏核验：
              {activeDuel.breachAudit.riskLevel === 'SAFE'
                ? '通过'
                : activeDuel.breachAudit.riskLevel === 'WARNING'
                ? '越级预警'
                : '严重崩坏'}
            </div>
            <p className="text-[10px] opacity-90">{activeDuel.breachAudit.diagnostic}</p>
          </div>

          {/* 四段拆招备忘 */}
          <div className="space-y-1.5">
            <div className="font-semibold text-[11px] text-[var(--ink-text-muted)]">
              四段博弈拆招备忘：
            </div>
            <div className="space-y-1">
              {activeDuel.beats.map((beat, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-[10px] space-y-0.5"
                >
                  <div className="font-semibold text-amber-500">
                    {idx + 1}. {beat.moveName} ({beat.attacker})
                  </div>
                  <div className="text-[var(--ink-text-muted)] line-clamp-1">
                    {beat.tacticDescription}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="py-8 text-center text-[var(--ink-text-muted)] text-[11px]">
          暂未配置当前篇章演武对决，可在大视图中创建双方境界梯队与四段博弈。
        </div>
      )}
    </div>
  )
}
