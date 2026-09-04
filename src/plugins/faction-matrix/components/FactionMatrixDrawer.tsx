import { useState, useEffect, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import type { FactionNode } from '../types'
import { factionMatrixEngine } from '../engine/FactionMatrixEngine'
import { indexedDbCodexEntityRepository } from '../../../adapters/indexedDbCodexEntityRepository'
import { Shield } from 'lucide-react'

const DEFAULT_DEMO_FACTIONS: FactionNode[] = [
  { id: 'f-xuanjian', name: '玄剑宗', type: 'righteous', powerTier: '正道七大派', protagonistReputation: 35 },
  { id: 'f-zixia', name: '紫霞派', type: 'righteous', powerTier: '名门宗派', protagonistReputation: 15 },
  { id: 'f-xuesha', name: '血煞门', type: 'demonic', powerTier: '魔道巨擘', protagonistReputation: -45 },
]

export const FactionMatrixDrawer: FC<DesktopPluginDrawerProps> = ({ projectId }) => {
  const [factions, setFactions] = useState<FactionNode[]>(DEFAULT_DEMO_FACTIONS)

  const loadData = async () => {
    try {
      const allCodex = await indexedDbCodexEntityRepository.getAll()
      const codexFactions = allCodex
        .filter((e) => (!e.projectId || e.projectId === projectId) && e.category === 'faction')
        .map((e) => ({
          id: e.id,
          name: e.name,
          type: 'righteous' as const,
          powerTier: (e.attributes?.powerTier as string) || '宗门',
          protagonistReputation: Number(e.attributes?.reputation ?? 10),
        }))

      if (codexFactions.length >= 2) {
        setFactions(codexFactions)
      }
    } catch (e) {
      console.error('Failed to load drawer factions:', e)
    }
  }

  useEffect(() => {
    loadData()
  }, [projectId])

  return (
    <div className="h-full flex flex-col bg-[var(--ink-bg-panel)] text-[var(--ink-text)] overflow-y-auto p-4 space-y-4 text-xs">
      <div className="flex items-center justify-between border-b border-[var(--ink-border)] pb-3">
        <div className="flex items-center gap-1.5 font-semibold">
          <Shield className="w-4 h-4 text-emerald-500" />
          <span>宗门势力声望</span>
        </div>
        <span className="text-[10px] text-[var(--ink-text-muted)]">
          登记势力: {factions.length}
        </span>
      </div>

      <div className="space-y-2">
        <span className="text-[11px] font-semibold text-[var(--ink-text-muted)] block">
          主角当前声望天平：
        </span>
        <div className="space-y-1.5">
          {factions.map((f) => {
            const rep = factionMatrixEngine.getReputationLevel(f.protagonistReputation)
            return (
              <div
                key={f.id}
                className="p-2 rounded-lg bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)]/60 text-[11px] flex items-center justify-between"
              >
                <div>
                  <span className="font-semibold text-[var(--ink-text)] block">{f.name}</span>
                  <span className="text-[10px] text-[var(--ink-text-muted)]">{rep.desc}</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.2 rounded border font-medium ${rep.badgeClass}`}>
                  {rep.label} ({f.protagonistReputation > 0 ? `+${f.protagonistReputation}` : f.protagonistReputation})
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
