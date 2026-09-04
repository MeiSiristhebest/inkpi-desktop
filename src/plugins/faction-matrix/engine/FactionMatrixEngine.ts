import type {
  FactionNode,
  FactionDiplomacyRecord,
  BalanceParadox,
  EventRippleResult,
  FactionStance,
} from '../types'

export class FactionMatrixEngine {
  /**
   * 声望数值映射阶梯
   */
  getReputationLevel(score: number): {
    label: string
    color: string
    badgeClass: string
    desc: string
  } {
    const clamped = Math.max(-100, Math.min(100, score))
    if (clamped <= -70) {
      return {
        label: '不死不休',
        color: '#ef4444',
        badgeClass: 'bg-rose-500/15 text-rose-500 border-rose-500/30',
        desc: '发布全宗诛杀令，宗门弟子见之必杀，不可调和。',
      }
    }
    if (clamped <= -30) {
      return {
        label: '敌对仇视',
        color: '#f97316',
        badgeClass: 'bg-orange-500/15 text-orange-500 border-orange-500/30',
        desc: '明争暗斗，处处打压排挤，随时可能爆发冲突。',
      }
    }
    if (clamped < 30) {
      return {
        label: '中立观望',
        color: '#94a3b8',
        badgeClass: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
        desc: '无利益瓜葛，公事公办，客套疏离。',
      }
    }
    if (clamped < 70) {
      return {
        label: '友好往来',
        color: '#3b82f6',
        badgeClass: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
        desc: '视为主力客卿或亲善友人，愿意共享中阶资源与情报。',
      }
    }
    return {
      label: '生死同盟',
      color: '#10b981',
      badgeClass: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
      desc: '托付底蕴与未来，同生共死，全宗鼎力支持。',
    }
  }

  /**
   * 模拟事件对全图地缘势力的连锁涟漪影响
   */
  simulateEventRipple(
    factions: FactionNode[],
    diplomacies: FactionDiplomacyRecord[],
    targetFactionId: string,
    directDelta: number
  ): EventRippleResult {
    const target = factions.find((f) => f.id === targetFactionId)
    const directName = target ? target.name : '目标势力'

    const ripples: EventRippleResult['ripples'] = []

    // 找到与 target 具有明确外交关系的势力
    for (const fac of factions) {
      if (fac.id === targetFactionId) continue

      // 查找双方外交记录
      const dip = diplomacies.find(
        (d) =>
          (d.factionAId === targetFactionId && d.factionBId === fac.id) ||
          (d.factionBId === targetFactionId && d.factionAId === fac.id)
      )

      if (!dip) continue

      let change = 0
      let reason = ''

      const isAlliedOrFriendly = dip.stance === 'allied' || dip.stance === 'friendly' || dip.stance === 'vassal'
      const isHostileOrEnemy = dip.stance === 'hostile' || dip.stance === 'mortal_enemy'

      if (directDelta < 0) {
        // 主角打击了 target 势力
        if (isAlliedOrFriendly) {
          change = Math.round(directDelta * 0.5)
          reason = `与【${directName}】结为同盟/友善，见其受创，对主角心生怨怼。`
        } else if (isHostileOrEnemy) {
          change = Math.round(Math.abs(directDelta) * 0.5)
          reason = `“敌人的敌人即是朋友”！见宿敌【${directName}】遭重创，大快人心。`
        }
      } else if (directDelta > 0) {
        // 主角帮助/讨好了 target 势力
        if (isAlliedOrFriendly) {
          change = Math.round(directDelta * 0.3)
          reason = `与【${directName}】同盟互利，认可主角贡献。`
        } else if (isHostileOrEnemy) {
          change = -Math.round(directDelta * 0.4)
          reason = `见宿敌【${directName}】壮大，对施援者主角忌惮加深。`
        }
      }

      if (change !== 0) {
        const newReputation = Math.max(-100, Math.min(100, fac.protagonistReputation + change))
        ripples.push({
          factionId: fac.id,
          factionName: fac.name,
          change,
          newReputation,
          reason,
        })
      }
    }

    return {
      directFaction: directName,
      directChange: directDelta,
      ripples,
    }
  }

  /**
   * 结构平衡理论 (Heider Balance)：排查三元组地缘悖论
   */
  detectStructuralParadoxes(
    factions: FactionNode[],
    diplomacies: FactionDiplomacyRecord[]
  ): BalanceParadox[] {
    const paradoxes: BalanceParadox[] = []
    const getStance = (idA: string, idB: string): FactionStance => {
      const rec = diplomacies.find(
        (d) =>
          (d.factionAId === idA && d.factionBId === idB) ||
          (d.factionBId === idA && d.factionAId === idB)
      )
      return rec ? rec.stance : 'neutral'
    }

    // 遍历任意三元组 (i, j, k)
    for (let i = 0; i < factions.length; i++) {
      for (let j = i + 1; j < factions.length; j++) {
        for (let k = j + 1; k < factions.length; k++) {
          const fA = factions[i]
          const fB = factions[j]
          const fC = factions[k]

          const sAB = getStance(fA.id, fB.id)
          const sBC = getStance(fB.id, fC.id)
          const sAC = getStance(fA.id, fC.id)

          // 悖论形态 1：A 与 B 同盟，B 与 C 同盟，但 A 与 C 是不死不休
          if (
            (sAB === 'allied' || sAB === 'friendly') &&
            (sBC === 'allied' || sBC === 'friendly') &&
            sAC === 'mortal_enemy'
          ) {
            paradoxes.push({
              factionA: fA.name,
              factionB: fB.name,
              factionC: fC.name,
              stanceAB: sAB,
              stanceBC: sBC,
              stanceAC: sAC,
              reason: `地缘结构失衡：【${fA.name}】与【${fB.name}】同盟，【${fB.name}】与【${fC.name}】同盟，但【${fA.name}】却与【${fC.name}】生死仇杀。中间人【${fB.name}】面临严峻站队悖论！`,
            })
          }
        }
      }
    }

    return paradoxes
  }
}

export const factionMatrixEngine = new FactionMatrixEngine()
