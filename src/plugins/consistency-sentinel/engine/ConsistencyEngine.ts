import type {
  PowerTierSystem,
  ConsistencyViolation,
  PresetTierSystem,
  TierRelation,
  PosetValidationResult,
} from '../types'
import presetTiersData from '../data/preset-tiers.json'
import { idGenerator } from '../../../adapters/idGenerator'

const VICTORY_VERBS = [
  '击败',
  '斩杀',
  '重创',
  '镇压',
  '秒杀',
  '打死',
  '手撕',
  '斩落',
  '废去',
  '轰杀',
  '刺死',
]
const DEFEAT_VERBS = ['败于', '死于', '受创于', '不敌', '饮恨于']
const ACTIVE_VERBS = [
  '说',
  '走',
  '冲',
  '拔出',
  '冷笑',
  '出手',
  '点头',
  '叹息',
  '盘膝',
  '飞身',
  '狂笑',
  '怒吼',
  '挥剑',
]
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const maskDialogue = (text: string) =>
  text.replace(/“[^”]*”|「[^」]*」|『[^』]*』|"[^"]*"/g, (quote) => ' '.repeat(quote.length))
const uncertain =
  /没有|没能|未能|不曾|不能|并非|无法|不会|不可能|打算|计划|想要|试图|如果|假如|倘若|要是|据说|声称|传闻|认为|以为|幻想/

function assertionPrefix(text: string, index: number): string {
  const prefix = text.slice(0, index)
  return prefix.slice(
    Math.max(
      prefix.lastIndexOf('。'),
      prefix.lastIndexOf('！'),
      prefix.lastIndexOf('？'),
      prefix.lastIndexOf('\n'),
    ) + 1,
  )
}

export class ConsistencyEngine {
  private closureCache = new Map<string, Map<string, Set<string>>>()
  public getPresetSystems(): PresetTierSystem[] {
    return presetTiersData as PresetTierSystem[]
  }
  public emptySystem(projectId: string): PowerTierSystem {
    return { projectId, systemName: '', tiers: [], specialModifiers: [], updatedAt: 0 }
  }
  private relations(tiers: string[], relations?: TierRelation[]): TierRelation[] {
    return (
      relations ??
      tiers.slice(1).map((higherTier, index) => ({ lowerTier: tiers[index], higherTier }))
    )
  }
  public detectCycles(tiers: string[], relations: TierRelation[]): string[][] {
    const adjacency = new Map(tiers.map((tier) => [tier, [] as string[]]))
    for (const relation of relations)
      if (adjacency.has(relation.lowerTier) && adjacency.has(relation.higherTier))
        adjacency.get(relation.lowerTier)!.push(relation.higherTier)
    const states = new Map<string, number>()
    const cycles: string[][] = []
    for (const root of adjacency.keys()) {
      if (states.get(root)) continue
      const stack = [{ node: root, index: 0 }]
      states.set(root, 1)
      while (stack.length) {
        const frame = stack[stack.length - 1]
        const next = adjacency.get(frame.node)![frame.index++]
        if (next === undefined) {
          states.set(frame.node, 2)
          stack.pop()
          continue
        }
        if (states.get(next) === 1) {
          const start = stack.findIndex((item) => item.node === next)
          cycles.push([...stack.slice(start).map((item) => item.node), next])
        } else if (!states.get(next)) {
          states.set(next, 1)
          stack.push({ node: next, index: 0 })
        }
      }
    }
    return cycles
  }
  public validatePosetDAG(tiers: string[], relations: TierRelation[]): PosetValidationResult {
    const errors: string[] = []
    const nodes = new Set(tiers)
    if (tiers.some((tier) => !tier.trim())) errors.push('等级名称不能为空。')
    if (nodes.size !== tiers.length) errors.push('等级名称重复。')
    if (
      relations.some(
        (relation) => !nodes.has(relation.lowerTier) || !nodes.has(relation.higherTier),
      )
    )
      errors.push('关系引用了未登记等级。')
    const cycles = this.detectCycles(tiers, relations)
    return {
      isAcyclic: cycles.length === 0,
      cycles,
      isValid: !errors.length && !cycles.length,
      errors,
    }
  }
  public buildTransitiveClosure(
    tiers: string[],
    relations?: TierRelation[],
  ): Map<string, Set<string>> {
    const edges = this.relations(tiers, relations)
    const result = new Map(tiers.map((tier) => [tier, new Set<string>()]))
    if (!this.validatePosetDAG(tiers, edges).isValid) return result
    const adjacency = new Map(tiers.map((tier) => [tier, [] as string[]]))
    for (const edge of edges) adjacency.get(edge.lowerTier)!.push(edge.higherTier)
    for (const root of tiers) {
      const visited = result.get(root)!
      const pending = [...adjacency.get(root)!]
      while (pending.length) {
        const node = pending.pop()!
        if (visited.has(node)) continue
        visited.add(node)
        pending.push(...adjacency.get(node)!)
      }
    }
    return result
  }
  public compareTiers(
    a: string,
    b: string,
    system: PowerTierSystem,
    relations?: TierRelation[],
  ): number {
    const edges = relations ?? system.relations
    if (
      !system.tiers.includes(a) ||
      !system.tiers.includes(b) ||
      !this.validatePowerHierarchy(system, edges).isValid
    )
      return NaN
    if (a === b) return 0
    const key = JSON.stringify([system.tiers, edges ?? null])
    let closure = this.closureCache.get(key)
    if (!closure) {
      closure = this.buildTransitiveClosure(system.tiers, edges)
      if (this.closureCache.size >= 128)
        this.closureCache.delete(this.closureCache.keys().next().value!)
      this.closureCache.set(key, closure)
    }
    return closure.get(a)?.has(b) ? -1 : closure.get(b)?.has(a) ? 1 : NaN
  }
  public validatePowerHierarchy(
    system: PowerTierSystem,
    relations?: TierRelation[],
  ): PosetValidationResult {
    return this.validatePosetDAG(
      system.tiers,
      this.relations(system.tiers, relations ?? system.relations),
    )
  }
  public scanPowerHierarchyCycles(
    system: PowerTierSystem,
    relations?: TierRelation[],
  ): ConsistencyViolation[] {
    const validation = this.validatePowerHierarchy(system, relations)
    return [
      ...validation.cycles.map((cycle) => ({
        id: idGenerator.generate('violation'),
        type: 'power_hierarchy_cycle' as const,
        severity: 'critical' as const,
        snippet: cycle.join(' < '),
        explanation: `作者等级关系包含环：${cycle.join(' -> ')}`,
        suggestedAction: '修正已登记关系后再比较等级。',
      })),
      ...validation.errors.map((message) => ({
        id: idGenerator.generate('violation'),
        type: 'term_inconsistency' as const,
        severity: 'critical' as const,
        snippet: '',
        explanation: message,
        suggestedAction: '修正等级名称和关系端点。',
      })),
    ]
  }
  public scanTextForInversions(
    text: string,
    entities: { name: string; realm?: string }[],
    system: PowerTierSystem,
  ): ConsistencyViolation[] {
    const masked = maskDialogue(text)
    const valid = entities.filter(
      (entity) =>
        entity.name &&
        entity.realm &&
        system.tiers.includes(entity.realm) &&
        entities.filter((other) => other.name === entity.name).length === 1,
    )
    const violations: ConsistencyViolation[] = []
    const seen = new Set<string>()
    for (const winner of valid)
      for (const loser of valid) {
        if (winner === loser || !(this.compareTiers(winner.realm!, loser.realm!, system) < 0))
          continue
        for (const passive of [false, true]) {
          const subject = passive ? loser : winner
          const object = passive ? winner : loser
          const verbs = passive ? DEFEAT_VERBS : VICTORY_VERBS
          const pattern = new RegExp(
            `${escape(subject.name)}([^，。！？\n:：]*?)(${verbs.join('|')})(?:了)?\\s*${escape(object.name)}`,
            'g',
          )
          for (const match of masked.matchAll(pattern)) {
            if (
              uncertain.test(assertionPrefix(masked, match.index) + match[1]) ||
              /说|告诉|问|看着|听见/.test(match[1]) ||
              entities.some(
                (entity) =>
                  entity.name && entity.name !== subject.name && match[1].includes(entity.name),
              )
            )
              continue
            const end = match.index + match[0].length
            const key = JSON.stringify([match.index, end, winner.name, loser.name])
            if (seen.has(key)) continue
            seen.add(key)
            const snippet = text.slice(match.index, end)
            const cues = system.specialModifiers.filter((cue) => cue && snippet.includes(cue))
            violations.push({
              id: idGenerator.generate('violation'),
              type: 'power_tier_inversion',
              severity: 'warning',
              status: 'candidate',
              startOffset: match.index,
              endOffset: end,
              snippet,
              entityName: winner.name,
              opponentName: loser.name,
              explanation: `字面战斗候选：${winner.name} 的登记等级低于 ${loser.name}。等级时点、动作真假和能力例外尚未确认。${cues.length ? `片段含作者例外词：${cues.join('、')}，仍需复核。` : ''}`,
              suggestedAction: '对照此战发生时的等级、能力和场景约束，确认是否需要修改。',
            })
          }
        }
      }
    return violations
  }
  public scanTextForDeceased(
    text: string,
    entities: { id: string; name: string; deathAtChapter?: number }[],
    currentChapter?: number,
  ): ConsistencyViolation[] {
    const masked = maskDialogue(text)
    const violations: ConsistencyViolation[] = []
    for (const entity of entities) {
      if (
        !entity.name ||
        (entity.deathAtChapter && currentChapter && currentChapter < entity.deathAtChapter)
      )
        continue
      const pattern = new RegExp(
        `${escape(entity.name)}(?:突然|缓缓|仍然|已经)?(${ACTIVE_VERBS.join('|')})`,
        'g',
      )
      for (const match of masked.matchAll(pattern)) {
        const prefix = assertionPrefix(masked, match.index)
        if (uncertain.test(prefix) || /回忆|想起|生前|仿佛看到|梦中|祭奠|遗照|残影/.test(prefix))
          continue
        const end = match.index + match[0].length
        violations.push({
          id: idGenerator.generate('violation'),
          type: 'deceased_character_active',
          severity: 'warning',
          status: 'candidate',
          startOffset: match.index,
          endOffset: end,
          snippet: text.slice(match.index, end),
          entityName: entity.name,
          explanation: `字面活动候选：${entity.name} 在当前设定中标记为已故。${entity.deathAtChapter && currentChapter ? '请核对该章的故事时间与状态变化。' : '死亡或当前片段时间未登记，不能据此确认冲突。'}`,
          suggestedAction: '核对故事时间、回忆/转述及作者确认的状态记录。',
        })
      }
    }
    return violations
  }
}

export const consistencyEngine = new ConsistencyEngine()
