// 战力阶梯与设定巡检哨兵核心引擎
// 严格偏序集（Poset DAG）、越阶战力倒错检测与死者复生矛盾审计

import type {
  PowerTierSystem,
  ConsistencyViolation,
  PresetTierSystem,
} from '../types'
import presetTiersData from '../data/preset-tiers.json'
import { idGenerator } from '../../../adapters/idGenerator'

const VICTORY_VERBS = ['击败', '斩杀', '重创', '镇压', '秒杀', '打死', '手撕', '斩落', '废去']
const ACTIVE_SUBJECT_VERBS = ['说', '道', '走', '冲', '拔出', '冷笑', '出手', '点头', '叹息', '盘膝']

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
   * 比较两个战力层级的高低顺序
   * @returns < 0 若 A 低于 B；0 若平级；> 0 若 A 高于 B；NaN 若无法比较
   */
  public compareTiers(tierA: string, tierB: string, system: PowerTierSystem): number {
    const idxA = system.tiers.indexOf(tierA)
    const idxB = system.tiers.indexOf(tierB)
    if (idxA === -1 || idxB === -1) return NaN
    return idxA - idxB
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
      for (let j = 0; j < validEntities.length; j++) {
        if (i === j) continue
        const attacker = validEntities[i]
        const defender = validEntities[j]

        const tierDiff = this.compareTiers(attacker.realm!, defender.realm!, system)
        // 只有当 attacker 境界严格低于 defender 时才需要审查
        if (tierDiff >= 0 || isNaN(tierDiff)) continue

        for (const verb of VICTORY_VERBS) {
          // 匹配：例如 "楚凌霄击败赵长老" 或 "楚凌霄一剑斩杀赵长老"
          const pattern = new RegExp(
            `${attacker.name}[^，。！？\n]{0,10}${verb}[^，。！？\n]{0,10}${defender.name}`,
            'g',
          )
          const match = pattern.exec(text)
          if (match) {
            const startIdx = Math.max(0, match.index - 80)
            const endIdx = Math.min(text.length, match.index + match[0].length + 80)
            const surroundingContext = text.slice(startIdx, endIdx)

            // 检查上下文是否含有合法的越阶修饰词（如偷袭、禁器、自爆）
            const hasModifier = system.specialModifiers.some((mod) =>
              surroundingContext.includes(mod),
            )

            if (!hasModifier) {
              violations.push({
                id: idGenerator.generate('violation'),
                type: 'power_tier_inversion',
                severity: 'critical',
                snippet: match[0],
                entityName: attacker.name,
                opponentName: defender.name,
                explanation: `【${attacker.name}】（${attacker.realm}）越阶击败了【${defender.name}】（${defender.realm}），前后未检测到合理的底牌、偷袭或借力交待。`,
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
        // 匹配：例如 "李长老冷笑道"、"李长老走上前"
        const pattern = new RegExp(`${entity.name}[^，。！？\n]{0,4}${verb}`, 'g')
        const match = pattern.exec(text)
        if (match) {
          // 排除回忆上下文：如 "回忆起李长老" 或 "想起李长老生前"
          const prefix = text.slice(Math.max(0, match.index - 15), match.index)
          if (prefix.includes('回忆') || prefix.includes('想起') || prefix.includes('生前') || prefix.includes('仿佛看到')) {
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
