import { useState, useEffect, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import type {
  FactionNode,
  FactionDiplomacyRecord,
  FactionStance,
  BalanceParadox,
  EventRippleResult,
} from '../types'
import { factionMatrixEngine } from '../engine/FactionMatrixEngine'
import { indexedDbFactionDiplomacyRepository } from '../../../adapters/indexedDbFactionDiplomacyRepository'
import { indexedDbCodexEntityRepository } from '../../../adapters/indexedDbCodexEntityRepository'
import { clock } from '../../../adapters/clock'
import { idGenerator } from '../../../adapters/idGenerator'
import {
  Shield,
  Zap,
  CheckCircle2,
  AlertTriangle,
  GitBranch,
} from 'lucide-react'

const DEFAULT_DEMO_FACTIONS: FactionNode[] = [
  { id: 'f-xuanjian', name: '玄剑宗', type: 'righteous', powerTier: '正道七大派', protagonistReputation: 35 },
  { id: 'f-zixia', name: '紫霞派', type: 'righteous', powerTier: '名门宗派', protagonistReputation: 15 },
  { id: 'f-xuesha', name: '血煞门', type: 'demonic', powerTier: '魔道巨擘', protagonistReputation: -45 },
]

export const FactionMatrixMasterView: FC<DesktopPluginViewProps> = ({ projectId }) => {
  const [factions, setFactions] = useState<FactionNode[]>(DEFAULT_DEMO_FACTIONS)
  const [diplomacies, setDiplomacies] = useState<FactionDiplomacyRecord[]>([])

  // 事件涟漪推演状态
  const [rippleTargetId, setRippleTargetId] = useState('')
  const [rippleDelta, setRippleDelta] = useState(-30)
  const [rippleResult, setRippleResult] = useState<EventRippleResult | null>(null)

  const loadAll = async () => {
    try {
      const [allCodex, allDips] = await Promise.all([
        indexedDbCodexEntityRepository.getAll(),
        indexedDbFactionDiplomacyRepository.getAll(projectId),
      ])

      const codexFactions = allCodex
        .filter((e) => (!e.projectId || e.projectId === projectId) && e.category === 'faction')
        .map((e) => ({
          id: e.id,
          name: e.name,
          type: 'righteous' as const,
          powerTier: (e.attributes?.powerTier as string) || (e.attributes?.位阶 as string) || '宗门',
          protagonistReputation: Number(e.attributes?.reputation ?? 10),
        }))

      const finalFactions = codexFactions.length >= 2 ? codexFactions : DEFAULT_DEMO_FACTIONS
      setFactions(finalFactions)
      setDiplomacies(allDips)
      if (finalFactions.length > 0 && !rippleTargetId) {
        setRippleTargetId(finalFactions[0].id)
      }
    } catch (e) {
      console.error('Failed to load faction data:', e)
    }
  }

  useEffect(() => {
    loadAll()
  }, [projectId])

  const getStance = (idA: string, idB: string): FactionStance => {
    const d = diplomacies.find(
      (rec) =>
        (rec.factionAId === idA && rec.factionBId === idB) ||
        (rec.factionBId === idA && rec.factionAId === idB)
    )
    return d ? d.stance : 'neutral'
  }

  const handleToggleStance = async (fA: FactionNode, fB: FactionNode) => {
    const existing = diplomacies.find(
      (rec) =>
        (rec.factionAId === fA.id && rec.factionBId === fB.id) ||
        (rec.factionBId === fA.id && rec.factionAId === fB.id)
    )

    let nextStance: FactionStance = 'allied'
    if (existing) {
      if (existing.stance === 'allied') nextStance = 'friendly'
      else if (existing.stance === 'friendly') nextStance = 'neutral'
      else if (existing.stance === 'neutral') nextStance = 'hostile'
      else if (existing.stance === 'hostile') nextStance = 'mortal_enemy'
      else nextStance = 'allied'
    }

    const record: FactionDiplomacyRecord = {
      id: existing ? existing.id : idGenerator.generate('dip'),
      projectId,
      factionAId: fA.id,
      factionAName: fA.name,
      factionBId: fB.id,
      factionBName: fB.name,
      stance: nextStance,
      reputationScore: nextStance === 'allied' ? 80 : nextStance === 'mortal_enemy' ? -90 : 0,
      updatedAt: clock.now(),
    }

    await indexedDbFactionDiplomacyRepository.save(record)
    await loadAll()
  }

  const handleRunRipple = () => {
    if (!rippleTargetId) return
    const res = factionMatrixEngine.simulateEventRipple(factions, diplomacies, rippleTargetId, rippleDelta)
    setRippleResult(res)
  }

  const paradoxes: BalanceParadox[] = factionMatrixEngine.detectStructuralParadoxes(
    factions,
    diplomacies
  )

  return (
    <div className="h-full flex flex-col bg-[var(--ink-bg-canvas)] text-[var(--ink-text)] overflow-hidden">
      {/* 顶栏 */}
      <div className="border-b border-[var(--ink-border)] bg-[var(--ink-bg-panel)] p-4 shrink-0 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight">势力声望与宗门地缘沙盘</h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 font-medium">
              符号平衡图 · 事件连锁涟漪推演
            </span>
          </div>
          <p className="text-xs text-[var(--ink-text-muted)] mt-0.5">
            掌控全书各大宗门外交敌友状态，推演主角大事件引发的声望仇恨连锁反应
          </p>
        </div>
      </div>

      {/* 主体滚动区 */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* 顶部：主角在各势力的声望卡片条 */}
        <div className="p-4 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] space-y-3">
          <span className="text-xs font-semibold text-[var(--ink-text)] flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-500" />
            主角全宗门声望天平
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {factions.map((f) => {
              const repInfo = factionMatrixEngine.getReputationLevel(f.protagonistReputation)
              return (
                <div
                  key={f.id}
                  className="p-3 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-canvas)] text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{f.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${repInfo.badgeClass}`}>
                      {repInfo.label} ({f.protagonistReputation > 0 ? `+${f.protagonistReputation}` : f.protagonistReputation})
                    </span>
                  </div>
                  <p className="text-[10px] text-[var(--ink-text-muted)]">{repInfo.desc}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* 中部：2D 外交地缘关系网格 */}
        <div className="p-4 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--ink-text)] flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
              宗门双边外交关系矩阵 (点击单元格切换关系)
            </span>
            <div className="flex items-center gap-2 text-[10px] text-[var(--ink-text-muted)]">
              <span>🟢 同盟</span>
              <span>🔵 友善</span>
              <span>⚪ 中立</span>
              <span>🟠 敌对</span>
              <span>🔴 不死不休</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--ink-border)] bg-[var(--ink-bg-elevated)]">
                  <th className="p-2.5 text-left font-medium text-[var(--ink-text-muted)] w-32">势力 \ 势力</th>
                  {factions.map((f) => (
                    <th key={f.id} className="p-2.5 text-center font-medium text-[var(--ink-text)] min-w-[110px]">
                      {f.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {factions.map((fA, idxA) => (
                  <tr key={fA.id} className="border-b border-[var(--ink-border)]/40 hover:bg-[var(--ink-bg-hover)]/20">
                    <td className="p-2.5 font-medium text-[var(--ink-text)]">{fA.name}</td>
                    {factions.map((fB, idxB) => {
                      if (idxA === idxB) {
                        return (
                          <td key={fB.id} className="p-2 text-center text-[10px] text-[var(--ink-text-muted)]">
                            —
                          </td>
                        )
                      }
                      const st = getStance(fA.id, fB.id)
                      return (
                        <td key={fB.id} className="p-2 text-center">
                          <button
                            onClick={() => handleToggleStance(fA, fB)}
                            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                              st === 'allied'
                                ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                                : st === 'friendly'
                                  ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                                  : st === 'hostile'
                                    ? 'bg-orange-500/15 text-orange-500 border border-orange-500/30'
                                    : st === 'mortal_enemy'
                                      ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
                                      : 'bg-[var(--ink-bg-canvas)] text-[var(--ink-text-muted)] border border-[var(--ink-border)]'
                            }`}
                          >
                            {st === 'allied'
                              ? '同盟'
                              : st === 'friendly'
                                ? '友善'
                                : st === 'hostile'
                                  ? '敌对'
                                  : st === 'mortal_enemy'
                                    ? '仇敌'
                                    : '中立'}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 底部双栏：事件连锁推演模拟器 (7 列) + 结构悖论检测 (5 列) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 左栏：大事件推演器 */}
          <div className="lg:col-span-7 p-4 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--ink-text)] flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                大事件连锁涟漪推演模拟
              </span>
              <button
                onClick={handleRunRipple}
                className="px-3 py-1 rounded-md bg-[var(--ink-accent)] text-white text-xs font-medium hover:opacity-90"
              >
                模拟涟漪影响
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-[var(--ink-text-muted)]">行动影响目标:</span>
              <select
                value={rippleTargetId}
                onChange={(e) => setRippleTargetId(e.target.value)}
                className="px-2 py-1 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-xs text-[var(--ink-text)]"
              >
                {factions.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>

              <span className="text-[var(--ink-text-muted)]">直接好感增减:</span>
              <select
                value={rippleDelta}
                onChange={(e) => setRippleDelta(Number(e.target.value))}
                className="px-2 py-1 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-xs text-[var(--ink-text)]"
              >
                <option value={-50}>-50 (诛杀真传/覆灭分舵)</option>
                <option value={-30}>-30 (大比当众击败/结仇)</option>
                <option value={+30}>+30 (拯救外门/归还秘籍)</option>
                <option value={+50}>+50 (挽救宗门大阵/生死救命)</option>
              </select>
            </div>

            {rippleResult && (
              <div className="p-3.5 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-canvas)] space-y-2 text-xs">
                <span className="font-semibold text-[var(--ink-text)]">
                  连锁反应推演分析（直接受创/获益：{rippleResult.directFaction} {rippleResult.directChange > 0 ? `+${rippleResult.directChange}` : rippleResult.directChange}）：
                </span>
                {rippleResult.ripples.length === 0 ? (
                  <p className="text-[11px] text-[var(--ink-text-muted)]">
                    该宗门暂无强外交绑定势力，未引发跨宗门连锁震荡。
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {rippleResult.ripples.map((rip, i) => (
                      <div
                        key={i}
                        className="p-2 rounded border border-[var(--ink-border)]/60 bg-[var(--ink-bg-elevated)] flex items-start justify-between gap-2 text-[11px]"
                      >
                        <div>
                          <span className="font-semibold text-[var(--ink-text)]">{rip.factionName}</span>
                          <p className="text-[10px] text-[var(--ink-text-muted)] mt-0.5">{rip.reason}</p>
                        </div>
                        <span className={`font-bold ${rip.change > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {rip.change > 0 ? `+${rip.change}` : rip.change}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 右栏：地缘平衡悖论排查 */}
          <div className="lg:col-span-5 p-4 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] space-y-3">
            <span className="text-xs font-semibold text-[var(--ink-text)] flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              地缘结构平衡理论排查
            </span>

            {paradoxes.length === 0 ? (
              <div className="p-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-emerald-600 text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>当前地缘格局结构平衡，无盟友背刺逻辑悖论。</span>
              </div>
            ) : (
              <div className="space-y-2">
                {paradoxes.map((p, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-xs text-rose-500 space-y-1"
                  >
                    <span className="font-semibold block">【三角地缘失衡警报】</span>
                    <p className="text-[11px] text-[var(--ink-text)] opacity-90">{p.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
