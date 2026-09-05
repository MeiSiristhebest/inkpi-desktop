import type { CombatActionBeat, PowerBreachAlert, CombatDuelTemplate } from '../types'
import { pluginEventBus } from '../../../core/pluginEventBus'

export class CombatSandboxEngine {
  /**
   * 经典修真战力标准梯队对照
   * 能量标度采用对数能级 Log10(E)：
   * 练气 (10^1) -> 筑基 (10^3) -> 金丹 (10^5) -> 元婴 (10^7) -> 化神 (10^9) -> 合体 (10^11) -> 大乘 (10^13) -> 渡劫 (10^15)
   */
  static readonly DEFAULT_TIERS = [
    { name: '练气期', rankValue: 1, energyLog10: 1 },
    { name: '筑基期', rankValue: 10, energyLog10: 3 },
    { name: '金丹期', rankValue: 20, energyLog10: 5 },
    { name: '元婴期', rankValue: 30, energyLog10: 7 },
    { name: '化神期', rankValue: 40, energyLog10: 9 },
    { name: '合体期', rankValue: 50, energyLog10: 11 },
    { name: '大乘期', rankValue: 60, energyLog10: 13 },
    { name: '渡劫飞升', rankValue: 70, energyLog10: 15 },
  ]

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
      const found = this.DEFAULT_TIERS.find((t) => t.rankValue === rank)
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
    projectId?: string
    protagonistName?: string
    enemyName?: string
  }): PowerBreachAlert {
    const {
      protagonistRank,
      enemyRank,
      compensatoryAssets,
      projectId,
      protagonistName,
      enemyName,
    } = params
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
          '本源至宝/天阶仙器绝对法则克制 (代偿系数 >= 1.5)',
          '敌方身负天道反噬/大阵地脉压制 (代偿系数 >= 1.2)',
          '主角寿元/极道禁术自残换取瞬时爆发 (代偿系数 >= 1.0)',
        )
      } else if (netDeficit > 0.4) {
        riskLevel = 'WARNING'
      }
    } else if (diff >= 8) {
      if (totalCompensatoryPower < 1.0 || netDeficit > 0.5) {
        riskLevel = 'WARNING'
        compensatoryFactorsNeeded.push(
          '五行/功法法则属性绝对克制',
          '消耗型符宝或一次性保命杀招',
          '主场大阵或借由高人法力遗泽',
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

    // 如果发生越级风险，自动向全系统广播 POWER_BREACH_DETECTED 事件
    if (isBreached && riskLevel !== 'SAFE') {
      try {
        pluginEventBus.emit('POWER_BREACH_DETECTED', {
          projectId: projectId || 'default',
          protagonistName: protagonistName || '主角',
          enemyName: enemyName || '高阶敌方',
          tierDiff: diff,
          riskLevel,
          diagnostic,
        })
      } catch (err) {
        console.warn('[CombatSandboxEngine] Failed to emit POWER_BREACH_DETECTED:', err)
      }
    }

    return {
      isBreached,
      tierDifference: diff,
      riskLevel,
      diagnostic,
      compensatoryFactorsNeeded,
    }
  }

  /**
   * 生成四段博弈微观拆招链 (起手试探 -> 变招相持 -> 杀招逼命 -> 绝境反杀)
   */
  static generateFourPhaseTemplate(
    protagonistName: string,
    enemyName: string,
    options?: {
      protagonistTechnique?: string
      enemyTechnique?: string
    },
  ): CombatDuelTemplate {
    const pTech = options?.protagonistTechnique || '九霄雷印法'
    const eTech = options?.enemyTechnique || '幽冥蚀骨罡'

    const beats: CombatActionBeat[] = [
      {
        phase: 'probing',
        attacker: enemyName,
        moveName: `${eTech}·神识锁定与试探式截杀`,
        tacticDescription: `${enemyName} 负手而立，散发高阶灵压封锁方圆百丈虚空，以一式随手弹指打出探路试探。`,
        damageOrConsequence: `${protagonistName} 提前侦测气机异动，踏奇门步法险险侧身避让，余波刮碎护体法衣。`,
      },
      {
        phase: 'escalation',
        attacker: protagonistName,
        moveName: `${pTech}·多重术式变招牵制与虚晃`,
        tacticDescription: `${protagonistName} 抛出三枚障目符箓遮蔽神识，同时虚引法诀诱使对方护体罡气偏转，直袭防线薄弱处。`,
        damageOrConsequence: `${enemyName} 眉头微皱被迫侧退半步化解暗劲，眼中轻蔑转为凝重，杀意暴涨。`,
      },
      {
        phase: 'climax_strike',
        attacker: enemyName,
        moveName: `${eTech}·本命法宝全开之必杀绝境`,
        tacticDescription: `${enemyName} 暴喝一声祭出本命煞兵，天地灵气瞬间被抽空抽干，形成断绝一切退路的锁空杀阵！`,
        damageOrConsequence: `${protagonistName} 护身至宝发出悲鸣瞬间布满裂纹，退路彻底断绝，命悬一线陷入绝境！`,
      },
      {
        phase: 'reversal_turn',
        attacker: protagonistName,
        moveName: `引爆预埋后手·破局反杀掀桌一击`,
        tacticDescription: `${protagonistName} 顺应败势诱敌深入，在对方胜券在握逼近三步的刹那，骤然引爆早已埋设好的本源克制杀招！`,
        damageOrConsequence: `${enemyName} 护体真罡如琉璃般轰然崩碎，满脸骇然倒飞喋血，战局彻底翻盘逆转！`,
      },
    ]

    return {
      title: `${protagonistName} 决战 ${enemyName} 四段微观拆招链`,
      beats,
    }
  }
}
