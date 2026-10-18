import { useEffect, useState, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import { indexedDbCodexEntityRepository } from '../../../adapters/indexedDbCodexEntityRepository'
import { indexedDbFactionDiplomacyRepository } from '../../../adapters/indexedDbFactionDiplomacyRepository'
import type { FactionNode, FactionDiplomacyRecord } from '../types'
import { factionMatrixEngine } from '../engine/FactionMatrixEngine'
export const FactionMatrixDrawer: FC<DesktopPluginDrawerProps> = (props) => (
  <FactionDrawerBody key={props.projectId} {...props} />
)
function FactionDrawerBody({ projectId, currentText }: DesktopPluginDrawerProps) {
  const [factions, setFactions] = useState<FactionNode[]>([])
  const [records, setRecords] = useState<FactionDiplomacyRecord[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    let disposed = false
    Promise.all([
      indexedDbCodexEntityRepository.getAll(),
      indexedDbFactionDiplomacyRepository.getAll(projectId),
    ])
      .then(([entities, relationships]) => {
        if (disposed) return
        setFactions(
          entities
            .filter((e) => e.projectId === projectId && e.category === 'faction')
            .map((e) => ({
              id: e.id,
              name: e.name,
              projectId,
              protagonistReputation:
                typeof e.attributes?.reputation === 'number' ? e.attributes.reputation : undefined,
            })),
        )
        setRecords(relationships.filter((r) => r.projectId === projectId))
      })
      .catch((cause) => {
        if (!disposed) setError(String(cause))
      })
    return () => {
      disposed = true
    }
  }, [projectId])
  return (
    <div className="p-4 space-y-3 text-xs">
      <h3>势力关系记录</h3>
      <p>仅对照登记名称和作者记录；提及名称不证明实际参与事件。</p>
      {error && <p role="alert">{error}</p>}
      {!factions.length ? (
        <p>设定库里还没有势力条目。</p>
      ) : (
        factions.map((f) => (
          <section key={f.id}>
            <h4>{f.name}</h4>
            <p>
              {f.name && currentText.includes(f.name)
                ? '正文名称命中，参与情况需要复核。'
                : '正文未出现此登记名称，参与情况未知。'}
            </p>
            <p>{factionMatrixEngine.getReputationLevel(f.protagonistReputation).desc}</p>
            {records
              .filter((r) => r.factionAId === f.id || r.factionBId === f.id)
              .map((r) => (
                <p key={r.id}>
                  {r.factionAName} → {r.factionBName}：{r.stance}；{r.notes || '未填写条件和依据。'}
                </p>
              ))}
          </section>
        ))
      )}
    </div>
  )
}
