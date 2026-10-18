import { useEffect, useMemo, useState, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import type {
  FactionNode,
  FactionDiplomacyRecord,
  FactionStance,
  EventRippleResult,
} from '../types'
import { factionMatrixEngine } from '../engine/FactionMatrixEngine'
import { indexedDbCodexEntityRepository } from '../../../adapters/indexedDbCodexEntityRepository'
import { indexedDbFactionDiplomacyRepository } from '../../../adapters/indexedDbFactionDiplomacyRepository'
import { codexApplicationService } from '../../../services/domainApplicationServices'
import { clock } from '../../../adapters/clock'
import { idGenerator } from '../../../adapters/idGenerator'
import { useOptionalPluginHostContext } from '../../../core/pluginHostContext'
import { usePluginAiTask } from '../../../core/usePluginAiTask'
import { PluginAiTaskPanel } from '../../../components/plugins/PluginAiTaskPanel'
import { semanticTextFromContent } from '../../../domain/content'
import { Select } from '../../../ui/primitives'
const STANCES: Record<FactionStance, string> = {
  allied: '同盟',
  friendly: '友好',
  neutral: '中立',
  hostile: '敌对',
  mortal_enemy: '仇敌',
  vassal: 'A 从属于 B',
}
const samePair = (record: FactionDiplomacyRecord, a: string, b: string) =>
  (record.factionAId === a && record.factionBId === b) ||
  (record.factionAId === b && record.factionBId === a)
export const FactionMatrixMasterView: FC<DesktopPluginViewProps> = (props) => (
  <FactionWorkspace key={props.projectId} {...props} />
)
function FactionWorkspace({ projectId }: DesktopPluginViewProps) {
  const host = useOptionalPluginHostContext()
  const [factions, setFactions] = useState<FactionNode[]>([])
  const [relationships, setRelationships] = useState<FactionDiplomacyRecord[]>([])
  const [reload, setReload] = useState(0)
  const [newName, setNewName] = useState('')
  const [newScore, setNewScore] = useState('')
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [stance, setStance] = useState<FactionStance>('neutral')
  const [notes, setNotes] = useState('')
  const [coefficient, setCoefficient] = useState('')
  const [rationale, setRationale] = useState('')
  const [target, setTarget] = useState('')
  const [delta, setDelta] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [ripple, setRipple] = useState<{ scope: string; result: EventRippleResult } | null>(null)
  const scope = JSON.stringify([factions, relationships, target, delta])
  const result = ripple?.scope === scope ? ripple.result : null
  const ai = usePluginAiTask('faction-matrix', [projectId, factions, relationships, target, delta])
  useEffect(() => {
    let disposed = false
    Promise.all([
      indexedDbCodexEntityRepository.getAll(),
      indexedDbFactionDiplomacyRepository.getAll(projectId),
    ])
      .then(([all, records]) => {
        if (disposed) return
        const real = all
          .filter((e) => e.projectId === projectId && e.category === 'faction')
          .map((e) => ({
            id: e.id,
            projectId: e.projectId,
            name: e.name,
            type:
              typeof e.attributes?.factionType === 'string' ? e.attributes.factionType : undefined,
            powerTier:
              typeof e.attributes?.powerTier === 'string' ? e.attributes.powerTier : undefined,
            protagonistReputation:
              typeof e.attributes?.reputation === 'number' &&
              Number.isFinite(e.attributes.reputation)
                ? e.attributes.reputation
                : undefined,
          }))
        setFactions(real)
        setRelationships(records.filter((r) => r.projectId === projectId))
        setTarget((previous) =>
          real.some((f) => f.id === previous) ? previous : (real[0]?.id ?? ''),
        )
      })
      .catch((cause) => {
        if (!disposed) setError(String(cause))
      })
    return () => {
      disposed = true
    }
  }, [projectId, reload])
  const graphErrors = useMemo(
    () => factionMatrixEngine.validateGraph(factions, relationships),
    [factions, relationships],
  )
  const candidates = useMemo(
    () =>
      graphErrors.length
        ? []
        : factionMatrixEngine.detectStructuralParadoxes(factions, relationships),
    [factions, relationships, graphErrors],
  )
  const operation = async (action: () => Promise<void>) => {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await action()
    } catch (cause) {
      setError(String(cause))
    } finally {
      setBusy(false)
    }
  }
  const create = () =>
    operation(async () => {
      if (!newName.trim()) throw new Error('填写实际势力名称。')
      if (newScore !== '' && !Number.isFinite(Number(newScore)))
        throw new Error('登记数值须为有限数值。')
      const now = clock.now()
      await codexApplicationService.saveEntity(
        {
          id: idGenerator.generate('ent_fac'),
          projectId,
          name: newName.trim(),
          category: 'faction',
          aliases: [],
          summary: '',
          relations: [],
          attributes: newScore === '' ? {} : { reputation: Number(newScore) },
          createdAt: now,
          updatedAt: now,
        },
        'author-confirmed',
      )
      setNewName('')
      setNewScore('')
      setReload((n) => n + 1)
      setMessage('已创建作者填写的势力。')
    })
  const saveRelationship = () =>
    operation(async () => {
      if (!a || !b || a === b) throw new Error('选择两个不同的实际势力。')
      const factionA = factions.find((f) => f.id === a),
        factionB = factions.find((f) => f.id === b)
      if (!factionA || !factionB) throw new Error('势力已经变化，请重新选择。')
      const previous = relationships.filter((r) => samePair(r, a, b))
      if (previous.length > 1) throw new Error('此关系有重复记录，先整理当前状态。')
      if (coefficient !== '' && (!Number.isFinite(Number(coefficient)) || !rationale.trim()))
        throw new Error('影响系数需要有限数值和适用理由。')
      const record: FactionDiplomacyRecord = {
        ...(previous[0] ?? {}),
        id: previous[0]?.id ?? idGenerator.generate('dip'),
        projectId,
        factionAId: a,
        factionAName: factionA.name,
        factionBId: b,
        factionBName: factionB.name,
        stance,
        notes,
        rippleCoefficient: coefficient === '' ? undefined : Number(coefficient),
        rippleRationale: coefficient === '' ? undefined : rationale,
        updatedAt: clock.now(),
      }
      await indexedDbFactionDiplomacyRepository.save(record)
      setRelationships((current) => [...current.filter((r) => r.id !== record.id), record])
      setMessage('已保存作者关系与事件假设。')
    })
  const edit = (fA: FactionNode, fB: FactionNode) => {
    const existing = relationships.find((r) => samePair(r, fA.id, fB.id))
    setA(existing?.factionAId ?? fA.id)
    setB(existing?.factionBId ?? fB.id)
    setStance(existing?.stance ?? 'neutral')
    setNotes(existing?.notes ?? '')
    setCoefficient(
      existing?.rippleCoefficient === undefined ? '' : String(existing.rippleCoefficient),
    )
    setRationale(existing?.rippleRationale ?? '')
  }
  return (
    <div className="p-6 space-y-4 h-full overflow-y-auto">
      <h2>作者势力关系与条件推演</h2>
      <p>
        关系空缺显示未知；声望数值不推导追杀、资源共享或结盟事实。事件结果仅按作者给定系数计算。
      </p>
      {error && <p role="alert">{error}</p>}
      {graphErrors.map((e) => (
        <p key={e} role="alert">
          {e}
        </p>
      ))}
      {message && <p role="status">{message}</p>}
      <input
        aria-label="新势力名称"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        placeholder="填写作品中的势力名"
      />
      <input
        aria-label="可选登记声望值"
        value={newScore}
        onChange={(e) => setNewScore(e.target.value)}
        type="number"
        placeholder="没有数值则留空"
      />
      <button disabled={busy || !newName.trim()} onClick={create}>
        保存并入库
      </button>
      {!factions.length && <p>设定库里尚无势力条目。</p>}
      {factions.map((f) => (
        <p key={f.id}>
          {f.name}：{factionMatrixEngine.getReputationLevel(f.protagonistReputation).desc}
        </p>
      ))}
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th>势力关系</th>
            {factions.map((f) => (
              <th key={f.id}>{f.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {factions.map((fA) => (
            <tr key={fA.id}>
              <th>{fA.name}</th>
              {factions.map((fB) => (
                <td key={fB.id}>
                  {fA.id === fB.id ? (
                    '—'
                  ) : (
                    <button onClick={() => edit(fA, fB)}>
                      {(() => {
                        const relation = relationships.find((r) => samePair(r, fA.id, fB.id))
                        return relation
                          ? relation.stance === 'vassal'
                            ? relation.factionAName + ' → ' + relation.factionBName
                            : STANCES[relation.stance]
                          : '未知'
                      })()}
                    </button>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <h3>明确登记关系</h3>
      <Select aria-label="关系势力 A" value={a} onValueChange={setA}>
        <option value="">选择势力 A</option>
        {factions.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </Select>
      <Select aria-label="关系势力 B" value={b} onValueChange={setB}>
        <option value="">选择势力 B</option>
        {factions.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </Select>
      <Select
        aria-label="作者关系状态"
        value={stance}
        onValueChange={(value) => setStance(value as FactionStance)}
      >
        {Object.entries(STANCES).map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </Select>
      <textarea
        aria-label="关系条件与依据"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="关系的时期、利益条件和原文依据"
      />
      <input
        aria-label="事件影响系数"
        type="number"
        step="any"
        value={coefficient}
        onChange={(e) => setCoefficient(e.target.value)}
        placeholder="可选系数，不填则影响未知"
      />
      <textarea
        aria-label="影响系数适用理由"
        value={rationale}
        onChange={(e) => setRationale(e.target.value)}
        placeholder="仅是作者假设；说明适用事件和方向"
      />
      <button disabled={busy || !a || !b || a === b} onClick={saveRelationship}>
        保存作者关系
      </button>
      <h3>作者条件推演</h3>
      <Select aria-label="行动影响目标" value={target} onValueChange={setTarget}>
        <option value="">选择目标</option>
        {factions.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </Select>
      <input
        aria-label="直接增减假设"
        type="number"
        step="any"
        value={delta}
        onChange={(e) => setDelta(e.target.value)}
      />
      <button
        disabled={!target || delta === '' || Boolean(graphErrors.length)}
        onClick={() => {
          setError('')
          try {
            setRipple({
              scope,
              result: factionMatrixEngine.simulateEventRipple(
                factions,
                relationships,
                target,
                Number(delta),
              ),
            })
          } catch (cause) {
            setError(String(cause))
          }
        }}
      >
        按作者系数计算
      </button>
      {result && (
        <section>
          {result.ripples.map((r) => (
            <p key={r.factionId}>
              {r.factionName}：
              {r.change === null
                ? '影响未知'
                : '假设增减 ' + r.change + '；计算后数值 ' + (r.newReputation ?? '基线未知')}
              。{r.reason}
            </p>
          ))}
        </section>
      )}
      <h3>关系三角复核候选</h3>
      {candidates.length ? (
        candidates.map((c, index) => (
          <p key={index}>
            {c.factionA}、{c.factionB}、{c.factionC}：{c.reason}
          </p>
        ))
      ) : (
        <p>没有满足当前符号条件的候选；这不证明关系没有其他问题。</p>
      )}
      {host?.aiAssistant?.isAvailable && (
        <button
          disabled={ai.isRunning || !factions.length}
          onClick={() =>
            ai.run({
              authorFactions: factions,
              authorRelationships: relationships.map((relationship) => ({
                ...relationship,
                notes:
                  relationship.notes === undefined
                    ? undefined
                    : semanticTextFromContent(`${relationship.id}-notes`, relationship.notes),
                rippleRationale:
                  relationship.rippleRationale === undefined
                    ? undefined
                    : semanticTextFromContent(
                        `${relationship.id}-rationale`,
                        relationship.rippleRationale,
                      ),
              })),
              structuralCandidates: candidates,
              eventHypothesis: {
                targetId: target,
                directDelta: delta === '' ? null : Number(delta),
              },
              missingInformation: '关系缺失、时期、目标和事件语境须明确说明；数值不是实测反应',
            })
          }
        >
          AI 关系与情境复核
        </button>
      )}
      <PluginAiTaskPanel view={ai.view} onRetry={ai.retry} />
    </div>
  )
}
