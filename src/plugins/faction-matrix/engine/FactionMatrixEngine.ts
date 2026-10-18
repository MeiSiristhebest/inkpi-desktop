import type {
  FactionNode,
  FactionDiplomacyRecord,
  BalanceParadox,
  EventRippleResult,
  FactionStance,
} from '../types'
const pairKey = (a: string, b: string) => JSON.stringify([a, b].sort())
const positive = (stance: FactionStance) => stance === 'allied' || stance === 'friendly'
const negative = (stance: FactionStance) => stance === 'hostile' || stance === 'mortal_enemy'
export class FactionMatrixEngine {
  getReputationLevel(score?: number | null) {
    const valid = typeof score === 'number' && Number.isFinite(score)
    return {
      label: valid ? '登记数值' : '未记录',
      color: '#94a3b8',
      badgeClass: 'bg-slate-500/10 text-slate-500 border-slate-500/30',
      desc: valid
        ? '登记值（来源需复核） ' + score + '；具体关系、行动和影响以作者记录为准。'
        : '没有作者声望数值，关系不能按中立补全。',
    }
  }
  validateGraph(factions: FactionNode[], records: FactionDiplomacyRecord[]): string[] {
    const errors: string[] = []
    const ids = new Set<string>()
    for (const faction of factions) {
      if (!faction.id.trim() || ids.has(faction.id)) errors.push('势力 ID 缺失或重复。')
      ids.add(faction.id)
    }
    const knownProjects = new Set(factions.map((f) => f.projectId).filter(Boolean))
    if (knownProjects.size > 1) errors.push('势力来自不同作品。')
    const pairs = new Set<string>()
    for (const record of records) {
      if (
        !ids.has(record.factionAId) ||
        !ids.has(record.factionBId) ||
        record.factionAId === record.factionBId
      )
        errors.push('关系端点缺失或指向同一势力。')
      const key = pairKey(record.factionAId, record.factionBId)
      if (pairs.has(key)) errors.push('同一对势力存在重复关系；先由作者整理当前状态。')
      pairs.add(key)
      if (knownProjects.size && !knownProjects.has(record.projectId))
        errors.push('关系来自其他作品。')
    }
    return [...new Set(errors)]
  }
  simulateEventRipple(
    factions: FactionNode[],
    diplomacies: FactionDiplomacyRecord[],
    targetId: string,
    directDelta: number,
  ): EventRippleResult {
    const errors = this.validateGraph(factions, diplomacies)
    if (errors.length) throw new Error(errors.join(' '))
    const target = factions.find((f) => f.id === targetId)
    if (!target || !Number.isFinite(directDelta))
      throw new Error('选择实际目标并填写有限的直接增减假设。')
    const ripples: EventRippleResult['ripples'] = factions
      .filter((f) => f.id !== targetId)
      .map((faction) => {
        const relation = diplomacies.find(
          (record) =>
            pairKey(record.factionAId, record.factionBId) === pairKey(targetId, faction.id),
        )
        const coefficient = relation?.rippleCoefficient
        if (coefficient === undefined || !relation?.rippleRationale?.trim())
          return {
            factionId: faction.id,
            factionName: faction.name,
            change: null,
            newReputation: null,
            status: 'unknown',
            reason: relation
              ? '已记录 ' + relation.stance + '；缺少事件影响系数或其适用理由。'
              : '尚未记录与目标的关系，影响未知。',
          }
        if (!Number.isFinite(coefficient)) throw new Error('事件影响系数必须是有限数值。')
        const change = directDelta * coefficient
        if (!Number.isFinite(change)) throw new Error('假设计算超出数值范围。')
        const baseline = faction.protagonistReputation
        const newReputation =
          typeof baseline === 'number' &&
          Number.isFinite(baseline) &&
          Number.isFinite(baseline + change)
            ? baseline + change
            : null
        return {
          factionId: faction.id,
          factionName: faction.name,
          change,
          newReputation,
          status: 'author_hypothesis',
          reason:
            '作者假设：' +
            relation.rippleRationale +
            '；增减 = ' +
            directDelta +
            ' × ' +
            coefficient +
            '。',
        }
      })
    return { directFaction: target.name, directChange: directDelta, ripples }
  }
  detectStructuralParadoxes(
    factions: FactionNode[],
    diplomacies: FactionDiplomacyRecord[],
  ): BalanceParadox[] {
    const errors = this.validateGraph(factions, diplomacies)
    if (errors.length) throw new Error(errors.join(' '))
    const pairs = new Map(
      diplomacies.map((record) => [pairKey(record.factionAId, record.factionBId), record.stance]),
    )
    const candidates: BalanceParadox[] = []
    for (let i = 0; i < factions.length; i++)
      for (let j = i + 1; j < factions.length; j++)
        for (let k = j + 1; k < factions.length; k++) {
          const a = factions[i],
            b = factions[j],
            c = factions[k]
          const ab = pairs.get(pairKey(a.id, b.id)),
            bc = pairs.get(pairKey(b.id, c.id)),
            ac = pairs.get(pairKey(a.id, c.id))
          if (
            !ab ||
            !bc ||
            !ac ||
            ![ab, bc, ac].every((stance) => positive(stance) || negative(stance))
          )
            continue
          const product = [ab, bc, ac].reduce((n, stance) => n * (positive(stance) ? 1 : -1), 1)
          if (product < 0)
            candidates.push({
              factionA: a.name,
              factionB: b.name,
              factionC: c.name,
              stanceAB: ab,
              stanceBC: bc,
              stanceAC: ac,
              status: 'review_candidate',
              reason:
                '三个已登记关系的正负号乘积为负。这是关系张力的复核候选；结盟动机、时期和交易条件未知，不能据此判定矛盾。',
            })
        }
    return candidates
  }
}
export const factionMatrixEngine = new FactionMatrixEngine()
