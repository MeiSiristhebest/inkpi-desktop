import type { DilemmaType, SparkSolution } from '../types'

export class BrainstormSparkEngine {
  /**
   * 8大叙事逆向破局算子库
   */
  static readonly OPERATORS = [
    {
      id: 'op_space_swap',
      name: '空间置换 / 金蝉脱壳',
      principle: '制造虚假核心目标吸引全部敌方火力，本体借由隐秘空间或镜像偷渡脱身。',
      twistImpact: 'dramatic' as const,
    },
    {
      id: 'op_sacrifice_break',
      name: '断尾求生 / 降维代价',
      principle: '主动自毁一项重宝、修为境界或关键地盘，以超出常理的代价打破死锁局面。',
      twistImpact: 'earthshaking' as const,
    },
    {
      id: 'op_third_party',
      name: '引狼入室 / 异数降临',
      principle: '引入敌我双方均无法控制的第三方毁灭性力量（上古古兽、敌国大军、天劫法则），打乱原有纳什均衡。',
      twistImpact: 'earthshaking' as const,
    },
    {
      id: 'op_rule_flip',
      name: '规则倒戈 / 掀桌破局',
      principle: '利用世界观中早已明示但被众人忽略的底层冷门铁律，将敌方的压倒性优势转变为致命破绽。',
      twistImpact: 'dramatic' as const,
    },
    {
      id: 'op_dormant_clue',
      name: '沉睡伏笔 / 闲笔回响',
      principle: '调动前文中主角随手赠予或忽视的小物件、微末人情，在生死攸关之际完成意想不到的闭环拯救。',
      twistImpact: 'subtle' as const,
    },
    {
      id: 'op_counter_trap',
      name: '自污入瓮 / 将计就计',
      principle: '主角假装中计彻底落败，借敌人胜券在握的狂喜与松懈，在敌方核心腹地引爆终极翻盘点。',
      twistImpact: 'dramatic' as const,
    },
    {
      id: 'op_internal_rift',
      name: '信息差疑冢 / 借刀反噬',
      principle: '精准散播半真半假的致命利益诱饵，激化反派阵营内部原本压抑的争权矛盾，引发内讧。',
      twistImpact: 'subtle' as const,
    },
    {
      id: 'op_conceptual_theft',
      name: '概念偷渡 / 契约悖论',
      principle: '在不可违抗的天道誓言或契约字句中寻找逻辑语义漏洞，表面顺从，实质反噬。',
      twistImpact: 'subtle' as const,
    },
  ]

  /**
   * 生成大语言模型推演 Prompt（用于通过 AiAssistant 端口实现工业级深度破局）
   */
  static buildAiPrompt(params: {
    dilemmaType: DilemmaType
    coreProblem: string
    currentSituation: string
    protagonistGoal: string
    enemyAdvantage: string
  }): string {
    const operatorSummaries = this.OPERATORS.map((op) => `- 【${op.name}】: ${op.principle}`).join('\n')
    return `你是一位顶级网文白金架构师。请针对小说作者当前的卡文困境进行深度推演。
【当前困境类型】: ${params.dilemmaType}
【核心死局问题】: ${params.coreProblem}
【当前危机局势】: ${params.currentSituation}
【主角战术目标】: ${params.protagonistGoal}
【敌方压倒优势】: ${params.enemyAdvantage}

请严格基于以下8大逆向破局算子库，结合博弈论纳什均衡打破原理，推导出逻辑自洽且充满反转张力的具体情节：
${operatorSummaries}

输出要求：每个方案需包含具体行动步骤、所需付出的不可逆代偿代价、以及该操作带来的次生危机。`
  }

  /**
   * 依据困境类型与博弈要素，动态推演纳什均衡打破策略（确定性离线算子引擎）
   */
  static generateSolutions(params: {
    dilemmaType: DilemmaType
    coreProblem: string
    currentSituation: string
    protagonistGoal: string
    enemyAdvantage: string
  }): SparkSolution[] {
    const { dilemmaType, coreProblem, currentSituation, protagonistGoal, enemyAdvantage } = params

    const problem = coreProblem?.trim() || '死局受制'
    const situation = currentSituation?.trim() || '强敌围困'
    const goal = protagonistGoal?.trim() || '脱困生还'
    const advantage = enemyAdvantage?.trim() || '绝对实力碾压'

    return this.OPERATORS.map((op) => {
      let concretePlot = ''
      let pros = ''
      let cons = ''

      switch (op.id) {
        case 'op_space_swap':
          concretePlot = `【声东击西转移场域】：针对当前「${situation}」，主角以明面上的假目标佯攻敌方「${advantage}」，暗中以遁术或假身调虎离山，金蝉脱壳实现「${goal}」。`
          pros = '打破局部视野封锁，产生强烈的视觉拉扯与智斗张力。'
          cons = '需在上一章节有主角收纳空间秘宝或影分身术式的铺垫，严防机械降神。'
          break

        case 'op_sacrifice_break':
          concretePlot = `【以沉重代价换取翻盘空间】：面对「${problem}」，主角在不可抗力下断然自碎本命灵兵/自降一个小境界，强行越阶引动反噬杀阵打破死锁。`
          pros = '极大增强危机真实性与悲壮感，杜绝无脑无伤推图的虚假悬念。'
          cons = '主角付出的代价不可在下章轻易逆转或复原，否则会严重伤害读者代入信誉。'
          break

        case 'op_third_party':
          concretePlot = `【引入不可控的第三方变量】：主角不与占据「${advantage}」的敌方正面对轰，而是以自身为饵引动禁地古兽/天道雷劫，将双边死斗升级为三方混乱风暴。`
          pros = '以极小杠杆撬动大场面崩解，符合弱者抗衡强者的第一性生存哲学。'
          cons = '第三方的入局必须具备自然地理或规则合理性，后续还需处理遗留的大危机。'
          break

        case 'op_rule_flip':
          concretePlot = `【利用底层规则反噬施暴者】：剖析敌人倚仗「${advantage}」的运转逻辑底层缺陷，以微末灵力拨动世界法则触发反向超载，使敌方底牌瞬间变为其催命符。`
          pros = '极具高智商对决爽感，展现主角对天地世界观法则的深邃洞察。'
          cons = '世界底层规则必须逻辑自洽闭环，绝不可当场现编现造。'
          break

        case 'op_dormant_clue':
          concretePlot = `【激活前文闲笔伏笔闭环】：在「${situation}」即将彻底吞没主角之际，主角此前无心赠予或拾得的微小因果（如旧信物、随手解救的乞儿）于此刻爆发关键连锁反应。`
          pros = '让老读者拍案叫绝，极大幅度提升长篇小说的厚重感与伏笔回收率。'
          cons = '必须与「契诃夫雷达/承诺台账」联动，必须在历史章节中真实存在。'
          break

        case 'op_counter_trap':
          concretePlot = `【将计就计引敌入瓮】：主角故意顺从敌方布置露出破绽并重伤倒地，诱使反派放下戒备踏入十步必杀禁区，刹那间引爆逆向绝杀陷阱。`
          pros = '网文经典绝地反杀节奏，憋屈感在瞬间得到极致宣泄兑现。'
          cons = '反派轻敌必须有充分的心态演变依据，切忌强行给反派降智。'
          break

        case 'op_internal_rift':
          concretePlot = `【利益诱饵瓦解敌方阵营】：瞄准敌方阵营中的附庸势力或野心二把手，抛出足以改变其命运的致命机缘，利用「${problem}」中的利益不均挑起敌国内讧。`
          pros = '生动展现修仙/争霸群像的复杂人心，展现权谋推演魅力。'
          cons = '需要为副手角色的背叛或动摇预设心理动机伏笔。'
          break

        case 'op_conceptual_theft':
          concretePlot = `【利用语义契约逻辑悖论】：面对天道誓约或规则囚笼，主角重新诠释契约条文字面边界，顺从字面要求但彻底颠覆其实质内涵，从逻辑死角突围。`
          pros = '让人意想不到的巧思智破，兼具惊艳与智斗趣味。'
          cons = '逻辑语义辨析需严密且符合玄学世界观，切忌耍无赖文字游戏。'
          break
      }

      if (dilemmaType === 'dead_end' && op.id === 'op_sacrifice_break') {
        pros = '★ 针对必死绝境的极致破局：悲壮与破局并存。'
      } else if (dilemmaType === 'hostage_threat' && op.id === 'op_space_swap') {
        pros = '★ 针对人质威胁的最佳解法：虚实互换解除人质危机。'
      }

      return {
        operatorId: op.id,
        operatorName: op.name,
        corePrinciple: op.principle,
        concretePlot,
        twistImpact: op.twistImpact,
        pros,
        cons,
      }
    })
  }
}
