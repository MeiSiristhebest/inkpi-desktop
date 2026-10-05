import type {
  CombatActionBeat,
  PowerBreachAlert,
  CombatDuelTemplate,
  PowerTierDefinition,
} from '../types'
import { pluginEventBus } from '../../../core/pluginEventBus'

export class CombatSandboxEngine {
  /**
   * 序位 → 对数能级的固定换算格点（Log10(J)）。
   *
   * §P2.4：这里只留数字，不留境界名。曾经它叫 DEFAULT_TIERS 并自带「练气期→渡劫飞升」，
   * 于是沙盘下拉框替每一本书选定了修真阶梯——阶梯属于世界设定，只能从作者的战力体系里读。
   */
  static readonly RANK_ENERGY_GRID = [
    { rankValue: 1, energyLog10: 1 },
    { rankValue: 10, energyLog10: 3 },
    { rankValue: 20, energyLog10: 5 },
    { rankValue: 30, energyLog10: 7 },
    { rankValue: 40, energyLog10: 9 },
    { rankValue: 50, energyLog10: 11 },
    { rankValue: 60, energyLog10: 13 },
    { rankValue: 70, energyLog10: 15 },
  ]

  /**
   * 把作者在自己战力体系里写下的阶梯映射成沙盘用的序位标度。
   * 序位按声明顺序等距排布，能量仍走 RANK_ENERGY_GRID 的同一把尺子。
   */
  static buildLadder(tiers: string[]): PowerTierDefinition[] {
    return tiers.map((name, index) => ({ name, rankValue: (index + 1) * 10 }))
  }

  /**
   * 严谨 Sigmoid 概率论：计算高境界对手对低境界对手的绝对压制率
   * 当 enemyRank > protagonistRank 时，压制率 > 0.5；
   * 当 protagonistRank > enemyRank 时，主角对敌方形成压制，敌方对主角压制率 < 0.5；
   * 当 deltaLogE = 0 时，双方势均力敌，压制率为 0.5。
   */
  static calculateSuppressionRate(protagonistRank: number, enemyRank: number): number {
    // 统一线性到对数映射标度：rankValue=1 -> 1.0, rankValue=10 -> 3.0, rankValue=70 -> 15.0
    // 线性插值斜率: (15 - 1) / (70 - 1) = 14 / 69 ≈ 0.203
    const getEnergy = (rank: number) => {
      const found = this.RANK_ENERGY_GRID.find((t) => t.rankValue === rank)
      if (found) return found.energyLog10
      return 1.0 + (rank - 1) * (14 / 69)
    }

    const pEnergy = getEnergy(protagonistRank)
    const eEnergy = getEnergy(enemyRank)

    const deltaLogE = eEnergy - pEnergy
    if (deltaLogE === 0) return 0.5

    const k = 1.2
    // 当 deltaLogE > 0 (敌强我弱)，rate > 0.5；
    // 当 deltaLogE < 0 (我强敌弱)，rate < 0.5；
    const rate = 1 / (1 + Math.exp(-k * deltaLogE))
    return Math.round(rate * 1000) / 1000
  }

  /**
   * 评估单项越级补偿因子的等效代偿能级 (Equivalent Compensatory Delta)
   */
  static evaluateAssetWeight(assetName: string): number {
    const trimmed = assetName.trim()
    if (!trimmed) return 0
    if (/(天阶|仙宝|道器|上古残卷|混沌|神器)/.test(trimmed)) return 1.5
    if (/(大阵|地脉|封印|天劫反噬|致命重伤|借力)/.test(trimmed)) return 1.2
    if (/(克制|真火|雷法|符宝|灵乳|神念)/.test(trimmed)) return 0.8
    return 0.5
  }

  /**
   * 战力对决能级差与崩坏巡检 (基于代偿能量平衡方程)
   */
  static auditPowerBreach(params: {
    protagonistRank: number
    enemyRank: number
    compensatoryAssets: string[]
  }): PowerBreachAlert {
    const { protagonistRank, enemyRank, compensatoryAssets } = params
    const diff = enemyRank - protagonistRank

    if (diff <= 0) {
      return {
        isBreached: false,
        tierDifference: 0,
        riskLevel: 'SAFE',
        diagnostic: '双方能级势均力敌或主角占优，无战力崩塌风险。',
        compensatoryFactorsNeeded: [],
      }
    }

    const suppressionRate = this.calculateSuppressionRate(protagonistRank, enemyRank)
    const totalCompensatoryPower = compensatoryAssets.reduce(
      (sum, item) => sum + this.evaluateAssetWeight(item),
      0,
    )

    // 能级赤字计算：Deficit = (diff * 0.2) - CompensatoryPower
    const baseDeficit = (diff / 10.0) * 1.5
    const netDeficit = Math.max(0, baseDeficit - totalCompensatoryPower)

    let riskLevel: 'SAFE' | 'WARNING' | 'CRITICAL_COLLAPSE' = 'SAFE'
    const compensatoryFactorsNeeded: string[] = []

    if (diff >= 18) {
      if (totalCompensatoryPower < 2.5 || netDeficit > 1.2) {
        riskLevel = 'CRITICAL_COLLAPSE'
        compensatoryFactorsNeeded.push(
          '一件足以抹平层级壁垒的底牌（代偿系数 ≥ 1.5）',
          '对手自身的硬伤、反噬或环境压制（代偿系数 ≥ 1.2）',
          '主角以自残、消耗寿元或禁术换取瞬时爆发（代偿系数 ≥ 1.0）',
        )
      } else if (netDeficit > 0.4) {
        riskLevel = 'WARNING'
      }
    } else if (diff >= 8) {
      if (totalCompensatoryPower < 1.0 || netDeficit > 0.5) {
        riskLevel = 'WARNING'
        compensatoryFactorsNeeded.push(
          '层级或属性上的绝对克制关系',
          '一次性消耗型的保命杀招',
          '主场准备或第三方助力的余荫',
        )
      }
    }

    const isBreached = riskLevel !== 'SAFE'
    const suppressionPct = Math.round(suppressionRate * 100)
    const diagnostic =
      riskLevel === 'CRITICAL_COLLAPSE'
        ? `🚨 战力体系严重崩塌！高阶压制率高达 ${suppressionPct}% (净能级赤字 ${netDeficit.toFixed(1)})，当前破局底牌不足以抵消境界壁垒，读者代入感极易崩解！`
        : riskLevel === 'WARNING'
          ? `⚠️ 越级挑战预警：面对高阶对手 (${suppressionPct}% 压制)，需铺垫足额代价要素 (当前补偿 ${totalCompensatoryPower.toFixed(1)} / 所需 ${baseDeficit.toFixed(1)})。`
          : `战力体系严密平稳：已配备 ${totalCompensatoryPower.toFixed(1)} 能级代偿资产，合理抹平跨阶压制。`

    // 事件不在这里发：auditPowerBreach 在渲染期被 useMemo 调用，一次重渲染就该广播一条
    // "战力崩坏"是给系统总线编造事实。广播改到 publishBreachAlert，由保存对决时显式调用。
    return {
      isBreached,
      tierDifference: diff,
      riskLevel,
      diagnostic,
      compensatoryFactorsNeeded,
    }
  }

  /**
   * 把越级结论广播给设定巡检（consistency-sentinel 订阅 POWER_BREACH_DETECTED）。
   * 只在作者显式保存一场对决时调用——那才是这条事实真正成立的时刻。
   */
  static publishBreachAlert(params: {
    projectId: string
    protagonistName: string
    enemyName: string
    alert: PowerBreachAlert
  }): void {
    const { projectId, protagonistName, enemyName, alert } = params
    if (alert.riskLevel === 'SAFE') return
    try {
      pluginEventBus.emit('POWER_BREACH_DETECTED', {
        projectId,
        protagonistName,
        enemyName,
        tierDiff: alert.tierDifference,
        riskLevel: alert.riskLevel,
        diagnostic: alert.diagnostic,
      })
    } catch (err) {
      console.warn('[CombatSandboxEngine] Failed to emit POWER_BREACH_DETECTED:', err)
    }
  }

  /**
   * 构建用于统一任务运行时的结构化战术分析输入。
   */
  static buildAnalysisInput(params: {
    protagonistName: string
    enemyName: string
    protagonistTechnique?: string
    enemyTechnique?: string
    battlefieldTerrain?: string
    plotGoal?: string
  }): Record<string, unknown> {
    return {
      protagonistName: params.protagonistName,
      enemyName: params.enemyName,
      protagonistTechnique: params.protagonistTechnique || '自修功法/核心绝技',
      enemyTechnique: params.enemyTechnique || '敌方绝杀功法',
      battlefieldTerrain: params.battlefieldTerrain || '绝壁深渊 / 荒古禁地',
      plotGoal: params.plotGoal || '逆风翻盘，绝境反杀',
      phases: ['probing', 'escalation', 'climax_strike', 'reversal_turn'],
      outputFields: ['title', 'beats'],
    }
  }

  /**
   * 生成四段博弈微观拆招链 (起手试探 -> 变招相持 -> 杀招逼命 -> 绝境反杀)
   *
   * 招式名与战场没有提供时留〔待填〕槽位：替作者发明「九霄雷印法」这种专有名词属于
   * 编造设定（INV-05），而且它默认了修真流派，科幻/历史书拿到的是错的世界。
   */
  static generateFourPhaseTemplate(
    protagonistName: string,
    enemyName: string,
    options?: {
      protagonistTechnique?: string
      enemyTechnique?: string
      terrain?: string
    },
  ): CombatDuelTemplate {
    const pTech = options?.protagonistTechnique?.trim() || '〔主角杀招·待填〕'
    const eTech = options?.enemyTechnique?.trim() || '〔对手杀招·待填〕'
    const terrain = options?.terrain?.trim() || '〔战场·待填〕'

    const beats: CombatActionBeat[] = [
      {
        phase: 'probing',
        attacker: enemyName,
        moveName: `${eTech}·气机锁定与试探式截杀`,
        tacticDescription: `${enemyName} 先手压上，借${terrain}封住退路，以一式随手攻击试探，迫使${protagonistName}暴露破绽。`,
        damageOrConsequence: `${protagonistName} 提前判断出杀意落点侧身避让，余波擦过防线，激起一圈肉眼可见的涟漪。`,
      },
      {
        phase: 'escalation',
        attacker: protagonistName,
        moveName: `${pTech}·多重变招牵制与虚晃`,
        tacticDescription: `${protagonistName} 借${terrain}掩护变招，数路攻势交织推进，诱使${enemyName}的防线偏向一侧，直取薄弱处。`,
        damageOrConsequence: `${enemyName} 眉头微皱被迫侧退化解暗劲，眼中的轻蔑转为凝重，杀意暴涨。`,
      },
      {
        phase: 'climax_strike',
        attacker: enemyName,
        moveName: `${eTech}·全域极境爆发之必杀死局`,
        tacticDescription: `${enemyName} 暴喝一声全力祭出杀招，${terrain}中的气流瞬间被抽空，化作断绝一切生机的毁灭死局！`,
        damageOrConsequence: `${protagonistName} 的底牌发出悲鸣，退路彻底断绝，命悬一线陷入绝境！`,
      },
      {
        phase: 'reversal_turn',
        attacker: protagonistName,
        moveName: `引爆克制杀招·绝境破局反杀`,
        tacticDescription: `${protagonistName} 顺应败势诱敌深入，在对方逼近、以为胜券在握的刹那，骤然引爆早已预埋的克制后手！`,
        damageOrConsequence: `${enemyName} 的防御如琉璃般轰然崩碎，满脸骇然倒飞喋血，战局彻底翻盘逆转！`,
      },
    ]

    return {
      title: `${protagonistName} 决战 ${enemyName} 四段微观拆招链`,
      beats,
    }
  }
}
