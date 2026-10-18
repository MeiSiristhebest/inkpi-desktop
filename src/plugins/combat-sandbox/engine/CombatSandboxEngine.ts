import type {
  CombatActionBeat,
  PowerBreachAlert,
  CombatDuelTemplate,
  PowerTierDefinition,
  CombatConstraint,
  CombatResourceBudget,
} from '../types'
import { pluginEventBus } from '../../../core/pluginEventBus'

export class CombatSandboxEngine {
  /** Author-declared ordinal positions, without a mapping to physical energy or probability. */
  static buildLadder(tiers: string[]): PowerTierDefinition[] {
    return tiers.map((name, index) => ({ name, rankValue: (index + 1) * 10 }))
  }

  static auditResourceBudget(budget: CombatResourceBudget) {
    if (
      !budget.name.trim() ||
      !Number.isFinite(budget.initial) ||
      budget.initial < 0 ||
      budget.consumptionByBeat.some((cost) => !Number.isFinite(cost) || cost < 0)
    )
      throw new RangeError('资源名称、初始量和每步消耗需要有效非负数。')
    let remaining = budget.initial
    const balances = budget.consumptionByBeat.map((cost, beatIndex) => {
      remaining -= cost
      return { beatIndex, cost, remaining }
    })
    return {
      name: budget.name,
      initial: budget.initial,
      balances,
      overdrawn: balances.filter((balance) => balance.remaining < 0),
    }
  }

  static auditPowerBreach(params: {
    protagonistRank: number
    enemyRank: number
    compensatoryAssets: string[]
    constraints?: CombatConstraint[]
    resourceBudgets?: CombatResourceBudget[]
  }): PowerBreachAlert {
    const validRanks =
      Number.isFinite(params.protagonistRank) &&
      Number.isFinite(params.enemyRank) &&
      params.protagonistRank > 0 &&
      params.enemyRank > 0
    const constraints = (params.constraints ?? []).filter((constraint) =>
      constraint.description.trim(),
    )
    // A marked result without a stated reason remains unknown.
    const violated = constraints.filter(
      (constraint) => constraint.status === 'violated' && constraint.rationale.trim(),
    )
    const resourceViolations = (params.resourceBudgets ?? []).flatMap((budget) =>
      this.auditResourceBudget(budget).overdrawn.map((balance) => ({
        id: 'resource:' + budget.name + ':' + balance.beatIndex,
        description:
          budget.name + '在第 ' + (balance.beatIndex + 1) + ' 步超支，余额 ' + balance.remaining,
      })),
    )
    const unknown = constraints.filter(
      (constraint) => constraint.status === 'unknown' || !constraint.rationale.trim(),
    )
    const completed =
      validRanks &&
      constraints.length > 0 &&
      constraints.every(
        (constraint) => constraint.status === 'satisfied' && constraint.rationale.trim(),
      )
    const status =
      violated.length || resourceViolations.length
        ? 'conflict'
        : completed
          ? 'consistent-with-declared-rules'
          : 'needs-review'
    return {
      isBreached: status === 'conflict',
      tierDifference: validRanks ? params.enemyRank - params.protagonistRank : 0,
      status,
      source: resourceViolations.length ? 'resource-budget' : 'author-constraint-review',
      violatedConstraintIds: [...violated, ...resourceViolations].map(
        (constraint) => constraint.id,
      ),
      riskLevel: status === 'conflict' ? 'CRITICAL_COLLAPSE' : completed ? 'SAFE' : 'WARNING',
      diagnostic: resourceViolations.length
        ? '按作者填写的资源初始量和消耗计算：' +
          resourceViolations.map((violation) => violation.description).join('；')
        : violated.length
          ? '有 ' +
            violated.length +
            ' 条约束被作者标为不满足：' +
            violated
              .map((constraint) => constraint.description + '（' + constraint.rationale + '）')
              .join('；')
          : completed
            ? '作者已对照理由确认本次列出的约束；未列出规则、情境和战斗结果仍需复核。'
            : '缺少已复核的能力、距离、资源或结果约束。等级只是序位，资产名称不能证明有效性，无法计算胜率或判定战力崩坏。',
      compensatoryFactorsNeeded: unknown.length
        ? unknown.map((constraint) => constraint.description)
        : completed
          ? []
          : ['补充能力的适用条件、限制、代价以及每一步后果。'],
    }
  }

  /** Broadcast only an explicitly reviewed conflict after its author saves the record. */
  static publishBreachAlert(params: {
    recordId: string
    projectId: string
    protagonistName: string
    enemyName: string
    alert: PowerBreachAlert
  }): void {
    const { recordId, projectId, protagonistName, enemyName, alert } = params
    if (!alert.isBreached || alert.status !== 'conflict' || !alert.source) return
    pluginEventBus.emit('POWER_BREACH_DETECTED', {
      recordId,
      projectId,
      protagonistName,
      enemyName,
      tierDiff: alert.tierDifference,
      riskLevel: 'CRITICAL_COLLAPSE',
      diagnostic: alert.diagnostic,
    })
  }

  static buildAnalysisInput(params: {
    protagonistName: string
    enemyName: string
    protagonistTechnique?: string
    enemyTechnique?: string
    battlefieldTerrain?: string
    plotGoal?: string
    constraints?: CombatConstraint[]
    costs?: string[]
    beats?: CombatActionBeat[]
  }): Record<string, unknown> {
    return {
      protagonistName: params.protagonistName,
      enemyName: params.enemyName,
      protagonistTechnique: params.protagonistTechnique?.trim() || null,
      enemyTechnique: params.enemyTechnique?.trim() || null,
      battlefieldTerrain: params.battlefieldTerrain?.trim() || null,
      plotGoal: params.plotGoal?.trim() || null,
      constraints: params.constraints ?? [],
      costs: params.costs ?? [],
      proposedBeats: params.beats ?? [],
      reviewCriteria: [
        'ability prerequisites',
        'range and timing',
        'resource consumption',
        'opponent response',
        'causal consequence',
        'outcome alternatives',
      ],
      missingContextPolicy:
        'Ask for missing facts; do not invent abilities, physics, terrain, victory or defeat.',
    }
  }

  /** Editable planning slots. They propose questions without asserting actions or an outcome. */
  static generateFourPhaseTemplate(
    protagonistName: string,
    enemyName: string,
    options?: { protagonistTechnique?: string; enemyTechnique?: string; terrain?: string },
  ): CombatDuelTemplate {
    const pTechnique = options?.protagonistTechnique?.trim() || '〔甲方能力·待填〕'
    const eTechnique = options?.enemyTechnique?.trim() || '〔乙方能力·待填〕'
    const terrain = options?.terrain?.trim() || '〔环境与距离·待填〕'
    const beats: CombatActionBeat[] = [
      {
        phase: 'probing',
        attacker: protagonistName,
        moveName: '信息与目标确认',
        tacticDescription:
          '明确 ' +
          protagonistName +
          ' 与 ' +
          enemyName +
          ' 的目标、已知信息和 ' +
          terrain +
          '；' +
          pTechnique +
          ' 能否生效？',
        damageOrConsequence: '〔观察结果、暴露信息与消耗·待填〕',
      },
      {
        phase: 'escalation',
        attacker: enemyName,
        moveName: '行动与对方应对',
        tacticDescription:
          '基于 ' + eTechnique + ' 选择行动，写明适用前提、距离、耗时及对方能作出的应对。',
        damageOrConsequence: '〔行动后果、失去的机会与成本·待填〕',
      },
      {
        phase: 'climax_strike',
        attacker: protagonistName,
        moveName: '关键选择与代价',
        tacticDescription: '对照已给能力和剩余资源选择关键行动，说明它如何改变局面。',
        damageOrConsequence: '〔资源余额、伤害或其他局面变化·待填〕',
      },
      {
        phase: 'reversal_turn',
        attacker: '〔结果行动方·待填〕',
        moveName: '结果与后续',
        tacticDescription: '根据前述因果选择胜、负、撤退、僵持或其他结果；新增条件需要作者确认。',
        damageOrConsequence: '〔胜负、持续代价与后续目标·待填〕',
      },
    ]
    return { title: protagonistName + ' 与 ' + enemyName + ' 的战术规划', beats }
  }
}
