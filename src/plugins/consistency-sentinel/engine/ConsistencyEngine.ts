import type {
  PowerTierSystem,
  ConsistencyViolation,
  PresetTierSystem,
  TierRelation,
  PosetValidationResult,
} from '../types'
import presetTiersData from '../data/preset-tiers.json'
import { idGenerator } from '../../../adapters/idGenerator'

const VICTORY_VERBS = ['击败', '斩杀', '重创', '镇压', '秒杀', '打死', '手撕', '斩落', '废去', '轰杀', '刺死']
const DEFEAT_VERBS = ['败于', '死于', '被杀', '受创于', '不敌', '饮恨于']
const ACTIVE_SUBJECT_VERBS = ['说', '道', '走', '冲', '拔出', '冷笑', '出手', '点头', '叹息', '盘膝', '飞身', '狂笑', '怒吼', '挥剑']

export class ConsistencyEngine {
  private customSystem: PowerTierSystem | null = null

  public setCustomSystem(system: PowerTierSystem | null): void {
    this.customSystem = system
  }

  public getPresetSystems(): PresetTierSystem[] {
    return presetTiersData as PresetTierSystem[]
  }

  public getDefaultSystem(): PowerTierSystem {
    if (this.customSystem) {
      return this.customSystem
    }
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
   * 严谨偏序集（Poset DAG）传递闭包计算（Warshall 算法）：
   * 构建有向图节点间的可达性矩阵 Reachable(A, B)，用于判定两境界是否有序及偏序可达关系。
   *
   * @param tiers 所有境界节点列表
   * @param directRelations 可选显式偏序边关系（lowerTier -> higherTier，即 lowerTier < higherTier）。
   *                        若未提供，则严格根据 tiers 线性顺序生成默认前驱后继边。
   * @returns Reachable Map: key 节点能严格到达的更高阶节点集合
   */
  public buildTransitiveClosure(
    tiers: string[],
    directRelations?: TierRelation[]
  ): Map<string, Set<string>> {
    const uniqueTiers = Array.from(new Set(tiers))
    const n = uniqueTiers.length
    const indexMap = new Map<string, number>()
    uniqueTiers.forEach((tier, idx) => indexMap.set(tier, idx))

    // 1. 初始化布尔可达邻接矩阵 (n x n)
    const reachMatrix: boolean[][] = Array.from({ length: n }, () =>
      Array.from({ length: n }, () => false)
    )

    // 2. 填充基础偏序边
    if (directRelations && directRelations.length > 0) {
      for (const rel of directRelations) {
        const u = indexMap.get(rel.lowerTier)
        const v = indexMap.get(rel.higherTier)
        if (u !== undefined && v !== undefined && u !== v) {
          reachMatrix[u][v] = true
        }
      }
    } else {
      // 默认线性全序体系中的相邻前驱边 (i -> i + 1)
      for (let i = 0; i < n - 1; i++) {
        reachMatrix[i][i + 1] = true
      }
    }

    // 3. Warshall 传递闭包算法核心三重循环：reachMatrix[i][j] = reachMatrix[i][j] || (reachMatrix[i][k] && reachMatrix[k][j])
    for (let k = 0; k < n; k++) {
      for (let i = 0; i < n; i++) {
        if (reachMatrix[i][k]) {
          for (let j = 0; j < n; j++) {
            if (reachMatrix[k][j]) {
              reachMatrix[i][j] = true
            }
          }
        }
      }
    }

    // 4. 转为 Map<string, Set<string>> 返回
    const reachable = new Map<string, Set<string>>()
    for (let i = 0; i < n; i++) {
      const uTier = uniqueTiers[i]
      const targetSet = new Set<string>()
      for (let j = 0; j < n; j++) {
        if (reachMatrix[i][j]) {
          targetSet.add(uniqueTiers[j])
        }
      }
      reachable.set(uTier, targetSet)
    }

    return reachable
  }

  /**
   * 基于偏序集比较两个战力层级的高低顺序
   * @param tierA 境界 A
   * @param tierB 境界 B
   * @param system 战力体系
   * @param directRelations 可选的显式偏序边关系
   * @returns < 0 若 tierA 严格低于 tierB；0 若同阶；> 0 若 tierA 严格高于 tierB；NaN 若二者不可比或非法
   */
  public compareTiers(
    tierA: string,
    tierB: string,
    system: PowerTierSystem,
    directRelations?: TierRelation[]
  ): number {
    if (!system.tiers.includes(tierA) || !system.tiers.includes(tierB)) {
      return NaN
    }
    if (tierA === tierB) return 0

    const closure = this.buildTransitiveClosure(system.tiers, directRelations)
    const aCanReachB = closure.get(tierA)?.has(tierB) // A < B
    const bCanReachA = closure.get(tierB)?.has(tierA) // B < A

    if (aCanReachB && !bCanReachA) return -1
    if (bCanReachA && !aCanReachB) return 1
    return NaN
  }

  /**
   * 偏序集环检测（Cycle Detection）与有向无环图（DAG）合法性校验：
   * 检测体系中是否存在逻辑闭环（例如 A < B < C < A 造成自身比自身强/弱的悖论）
   */
  public detectCycles(tiers: string[], directRelations: TierRelation[]): string[][] {
    const adj = new Map<string, string[]>()
    for (const t of tiers) {
      adj.set(t, [])
    }
    for (const rel of directRelations) {
      if (adj.has(rel.lowerTier) && tiers.includes(rel.higherTier)) {
        adj.get(rel.lowerTier)!.push(rel.higherTier)
      }
    }

    const visited = new Map<string, number>() // 0: unvisited, 1: visiting, 2: visited
    const cycles: string[][] = []
    const path: string[] = []

    const dfs = (node: string) => {
      visited.set(node, 1)
      path.push(node)

      const neighbors = adj.get(node) || []
      for (const next of neighbors) {
        const state = visited.get(next) ?? 0
        if (state === 1) {
          // 发现环，提取环路径
          const cycleStartIndex = path.indexOf(next)
          if (cycleStartIndex !== -1) {
            cycles.push([...path.slice(cycleStartIndex), next])
          }
        } else if (state === 0) {
          dfs(next)
        }
      }

      path.pop()
      visited.set(node, 2)
    }

    for (const t of tiers) {
      if ((visited.get(t) ?? 0) === 0) {
        dfs(t)
      }
    }

    return cycles
  }

  /**
   * 验证偏序集 DAG 合法性：无自环且无循环依赖
   */
  public validatePosetDAG(tiers: string[], directRelations: TierRelation[]): PosetValidationResult {
    const cycles = this.detectCycles(tiers, directRelations)
    return {
      isAcyclic: cycles.length === 0,
      cycles,
    }
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
   * 校验战力体系自身的逻辑自洽性（是否存在闭环悖论）
   */
  public validatePowerHierarchy(
    system: PowerTierSystem,
    directRelations?: TierRelation[]
  ): PosetValidationResult {
    if (!directRelations || directRelations.length === 0) {
      return { isAcyclic: true, cycles: [] }
    }
    return this.validatePosetDAG(system.tiers, directRelations)
  }

  /**
   * 扫描战力体系中的循环闭环违规
   */
  public scanPowerHierarchyCycles(
    system: PowerTierSystem,
    directRelations?: TierRelation[]
  ): ConsistencyViolation[] {
    const validation = this.validatePowerHierarchy(system, directRelations)
    if (validation.isAcyclic) return []

    return validation.cycles.map((cycle) => ({
      id: idGenerator.generate('violation'),
      type: 'power_hierarchy_cycle' as const,
      severity: 'critical' as const,
      snippet: cycle.join(' < '),
      explanation: `战力体系中检测到逻辑闭环矛盾：${cycle.join(' -> ')}，导致境界强弱无法确定。`,
      suggestedAction: `请修正境界偏序关系，消除闭环依赖（有向环），确保战力体系符合偏序集有向无环图（Poset DAG）。`,
    }))
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
