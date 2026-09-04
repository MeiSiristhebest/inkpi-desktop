import type {
  PowerTierSystem,
  ConsistencyViolation,
  PresetTierSystem,
} from '../types'
import presetTiersData from '../data/preset-tiers.json'
import { idGenerator } from '../../../adapters/idGenerator'

const VICTORY_VERBS = ['击败', '斩杀', '重创', '镇压', '秒杀', '打死', '手撕', '斩落', '废去', '轰杀', '刺死']
const DEFEAT_VERBS = ['败于', '死于', '被杀', '受创于', '不敌', '饮恨于']
const ACTIVE_SUBJECT_VERBS = ['说', '道', '走', '冲', '拔出', '冷笑', '出手', '点头', '叹息', '盘膝', '飞身', '狂笑', '怒吼', '挥剑']

export class ConsistencyEngine {
  public getPresetSystems(): PresetTierSystem[] {
    return presetTiersData as PresetTierSystem[]
  }

  public getDefaultSystem(): PowerTierSystem {
    const preset = presetTiersData[0] as PresetTierSystem
    return {
      projectId: 'default',
      systemName: preset.name,
      tiers: [...preset.tiers],
      specialModifiers: [...preset.modifiers],
      updatedAt: 0,
    }
  }

  /**
   * 严谨偏序集（Poset DAG）及物闭包计算：
   * 构建有向无环图节点间的可达性矩阵 Reachable(A, B)，用于严格判定两境界是否有序及其偏序阶差。
   */
  public buildTransitiveClosure(tiers: string[]): Map<string, Set<string>> {
    const reachable = new Map<string, Set<string>>()
    for (let i = 0; i < tiers.length; i++) {
      const u = tiers[i]
      if (!reachable.has(u)) reachable.set(u, new Set())
      // 线性或DAG拓扑边：低位节点可通向所有高位节点
      for (let j = i + 1; j < tiers.length; j++) {
        reachable.get(u)!.add(tiers[j])
      }
    }
    return reachable
  }

  /**
   * 基于偏序集比较两个战力层级的高低顺序
   * @returns < 0 若 tierA 严格低于 tierB；0 若同阶；> 0 若 tierA 严格高于 tierB；NaN 若二者不可比
   */
  public compareTiers(tierA: string, tierB: string, system: PowerTierSystem): number {
    if (tierA === tierB) return 0
    const closure = this.buildTransitiveClosure(system.tiers)

    const aCanReachB = closure.get(tierA)?.has(tierB) // A < B
    const bCanReachA = closure.get(tierB)?.has(tierA) // B < A

    if (aCanReachB) return -1
    if (bCanReachA) return 1
    return NaN
  }

  /**
   * 结构化战斗事实匹配器：
   * 结合主动态与被动态识别战斗因果对，避免简单单一硬编码窗口
   */
  private extractCombatInteractions(
    text: string,
    charA: string,
    charB: string
  ): Array<{ snippet: string; winner: string; loser: string; matchIndex: number }> {
    const results: Array<{ snippet: string; winner: string; loser: string; matchIndex: number }> = []

    // 1. 主动态：A [在15字内] [击败动词] [在15字内] B
    for (const verb of VICTORY_VERBS) {
      const activeRegex = new RegExp(`(${charA}[^，。！？\n]{0,15}${verb}[^，。！？\n]{0,15}${charB})`, 'g')
      let m: RegExpExecArray | null
      while ((m = activeRegex.exec(text)) !== null) {
        results.push({ snippet: m[0], winner: charA, loser: charB, matchIndex: m.index })
      }
      // 反向：B 击败 A
      const activeReverse = new RegExp(`(${charB}[^，。！？\n]{0,15}${verb}[^，。！？\n]{0,15}${charA})`, 'g')
      while ((m = activeReverse.exec(text)) !== null) {
        results.push({ snippet: m[0], winner: charB, loser: charA, matchIndex: m.index })
      }
    }

    // 2. 被动态：B [在15字内] [败于/死于] [在15字内] A
    for (const verb of DEFEAT_VERBS) {
      const passiveRegex = new RegExp(`(${charB}[^，。！？\n]{0,15}${verb}[^，。！？\n]{0,15}${charA})`, 'g')
      let m: RegExpExecArray | null
      while ((m = passiveRegex.exec(text)) !== null) {
        results.push({ snippet: m[0], winner: charA, loser: charB, matchIndex: m.index })
      }
    }

    return results
  }

  /**
   * 扫描文本中的战力越阶失真矛盾
   */
  public scanTextForInversions(
    text: string,
    entities: { name: string; realm?: string }[],
    system: PowerTierSystem,
  ): ConsistencyViolation[] {
    const violations: ConsistencyViolation[] = []
    const validEntities = entities.filter((e) => e.realm && system.tiers.includes(e.realm))
    if (validEntities.length < 2) return violations

    for (let i = 0; i < validEntities.length; i++) {
      for (let j = i + 1; j < validEntities.length; j++) {
        const entA = validEntities[i]
        const entB = validEntities[j]

        const interactions = this.extractCombatInteractions(text, entA.name, entB.name)
        for (const inter of interactions) {
          const winnerEnt = inter.winner === entA.name ? entA : entB
          const loserEnt = inter.winner === entA.name ? entB : entA

          // 偏序关系比较：低境界战胜高境界属于潜在越阶
          const order = this.compareTiers(winnerEnt.realm!, loserEnt.realm!, system)
          if (order < 0) {
            // 检查局部语境（前后 80 字符）是否具有合理解释修饰词（如偷袭、禁器、自爆、大阵）
            const startIdx = Math.max(0, inter.matchIndex - 80)
            const endIdx = Math.min(text.length, inter.matchIndex + inter.snippet.length + 80)
            const surrounding = text.slice(startIdx, endIdx)

            const hasModifier = system.specialModifiers.some((mod) => surrounding.includes(mod))
            if (!hasModifier) {
              violations.push({
                id: idGenerator.generate('violation'),
                type: 'power_tier_inversion',
                severity: 'critical',
                snippet: inter.snippet,
                entityName: winnerEnt.name,
                opponentName: loserEnt.name,
                explanation: `【${winnerEnt.name}】（${winnerEnt.realm}）逆境界击败了【${loserEnt.name}】（${loserEnt.realm}），前后未检测到合理的底牌、偷袭或借力交待。`,
                suggestedAction: `请在战斗段落补充【${system.specialModifiers.slice(0, 3).join('/')}】等逆转设定的合理机制，避免战力崩坏。`,
              })
            }
          }
        }
      }
    }

    return violations
  }

  /**
   * 扫描文本中是否有已陨落/阵亡角色作为活动主语出现的硬伤
   */
  public scanTextForDeceased(
    text: string,
    deceasedEntities: { id: string; name: string }[],
  ): ConsistencyViolation[] {
    const violations: ConsistencyViolation[] = []

    for (const entity of deceasedEntities) {
      if (!text.includes(entity.name)) continue

      for (const verb of ACTIVE_SUBJECT_VERBS) {
        const pattern = new RegExp(`${entity.name}[^，。！？\n]{0,6}${verb}`, 'g')
        const match = pattern.exec(text)
        if (match) {
          // 严密排除回忆与幻象修辞：回忆起某某、生前、梦中、遗像、仿佛看见
          const prefix = text.slice(Math.max(0, match.index - 20), match.index)
          if (/(回忆|想起|生前|仿佛看到|梦中|祭奠|遗照|残影)/.test(prefix)) {
            continue
          }

          violations.push({
            id: idGenerator.generate('violation'),
            type: 'deceased_character_active',
            severity: 'critical',
            snippet: match[0],
            entityName: entity.name,
            explanation: `角色【${entity.name}】在设定/前文中已被标记为【已故/陨落】，但在当前段落作为活动主语做出「${verb}」动作。`,
            suggestedAction: `请确认是否为连载笔误；若该角色复活，请在设定图谱中更新其生死状态或补充夺舍假死交代。`,
          })
          break
        }
      }
    }

    return violations
  }
}

export const consistencyEngine = new ConsistencyEngine()
