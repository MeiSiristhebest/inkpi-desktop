import { useState, useEffect, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import type { CombatDuelRecord } from '../types'
import { indexedDbCombatSandboxRepository } from '../../../adapters/indexedDbCombatSandboxRepository'
import { CombatSandboxEngine } from '../engine/CombatSandboxEngine'

export const CombatSandboxDrawer: FC<DesktopPluginDrawerProps> = (props) => (
  <CombatSandboxProjectDrawer key={props.projectId} {...props} />
)

const CombatSandboxProjectDrawer: FC<DesktopPluginDrawerProps> = ({ projectId, currentText }) => {
  const [duels, setDuels] = useState<CombatDuelRecord[]>([])
  const [notice, setNotice] = useState('')
  useEffect(() => {
    let disposed = false
    indexedDbCombatSandboxRepository
      .getAll(projectId)
      .then((all) => {
        if (!disposed) setDuels(all.filter((duel) => duel.projectId === projectId))
      })
      .catch(() => {
        if (!disposed) setNotice('读取对决失败。')
      })
    return () => {
      disposed = true
    }
  }, [projectId])
  const relevant = duels.filter(
    (duel) => currentText?.includes(duel.protagonistName) && currentText?.includes(duel.enemyName),
  )
  return (
    <div className="p-4 space-y-3 text-xs text-[var(--ink-text)]">
      <h3 className="text-sm font-semibold">战力对招随动感知</h3>
      {notice && <p role="alert">{notice}</p>}
      <p>下列已保存对决的双方名字在正文中均有字面提及，是否对应本场景仍需确认。</p>
      {relevant.length === 0 && <p>没有匹配的已保存对决，无法核对本场景的能力与消耗。</p>}
      {relevant.map((duel) => {
        let audit
        try {
          audit = CombatSandboxEngine.auditPowerBreach({
            protagonistRank: duel.protagonistRankValue,
            enemyRank: duel.enemyRankValue,
            compensatoryAssets: duel.compensatoryAssets,
            constraints: duel.constraints,
            resourceBudgets: duel.resourceBudgets,
          })
        } catch {
          audit = null
        }
        return (
          <section key={duel.id} className="border rounded p-3 space-y-2">
            <p>
              {duel.protagonistName} ({duel.protagonistTier})
            </p>
            <p>
              {duel.enemyName} ({duel.enemyTier})
            </p>
            <p>{duel.stakes || '未给定战斗目标与赌注'}</p>
            {!duel.breachAudit.status && <p>旧记录的公式结论未验证；以下按当前约束重新核对。</p>}
            <p>{audit?.diagnostic ?? '保存的参数无效，无法复核。'}</p>
            {duel.beats.map((beat, index) => (
              <div key={index}>
                <p>
                  {index + 1}. {beat.moveName} ({beat.attacker})
                </p>
                <p>{beat.tacticDescription}</p>
                <p>{beat.damageOrConsequence}</p>
              </div>
            ))}
          </section>
        )
      })}
    </div>
  )
}
