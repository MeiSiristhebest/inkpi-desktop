import type { DilemmaType, SparkSolution } from '../types'
export interface SparkInput {
  dilemmaType: DilemmaType
  coreProblem: string
  currentSituation: string
  protagonistGoal: string
  enemyAdvantage: string
  knownResources?: string[]
  constraints?: string[]
}
export class BrainstormSparkEngine {
  static readonly OPERATORS = [
    {
      id: 'op_space_swap',
      name: '改变地点或顺序',
      principle: '检查问题是否依赖于当前地点、顺序或时间窗口。',
      question: '能否换一个已建立的地点、调整行动顺序或等待一个明确窗口？',
    },
    {
      id: 'op_sacrifice_break',
      name: '交换与代价',
      principle: '检查可放弃的目标与不可越过的底线。',
      question: '角色愿意放弃哪项已经拥有的利益？代价由谁承担，之后是否仍然存在？',
    },
    {
      id: 'op_third_party',
      name: '第三方参与',
      principle: '使用已有角色的独立目标改变选择范围。',
      question: '哪位已建立的第三方有自己的介入理由？他能改变哪些条件，同时带来哪些限制？',
    },
    {
      id: 'op_rule_flip',
      name: '重新检查规则',
      principle: '只使用作者已明确的规则和例外。',
      question: '哪条已建立的规则限制了双方？是否存在双方都必须承担的约束或程序？',
    },
    {
      id: 'op_dormant_clue',
      name: '调用已有线索',
      principle: '检查前文真实出现的物件、关系和信息。',
      question: '哪条已出现且尚未使用的线索能增加选择？出现位置与可用条件是什么？',
    },
    {
      id: 'op_counter_trap',
      name: '改变对方预期',
      principle: '区分对方实际知道的事情与角色能控制的信息。',
      question: '对方根据什么证据行动？角色能改变哪项可观察信息，对方还有什么合理反应？',
    },
    {
      id: 'op_internal_rift',
      name: '分歧与协商',
      principle: '检查已有参与者的不同利益，允许合作和拒绝。',
      question: '参与者哪些目标一致、哪些不同？能否提出使其自行选择的交换，而非假设其背叛？',
    },
    {
      id: 'op_conceptual_theft',
      name: '澄清承诺边界',
      principle: '基于实际承诺的原句和双方解释。',
      question: '承诺的原句要求什么？哪项要求能澄清或重新协商，谁有权接受变更？',
    },
  ]
  static buildAnalysisInput(params: SparkInput): Record<string, unknown> {
    return {
      ...params,
      operators: this.OPERATORS,
      mode: 'creative_options',
      missingContext: Object.entries(params)
        .filter(([, value]) => typeof value === 'string' && !value.trim())
        .map(([key]) => key),
    }
  }
  static generateSolutions(params: SparkInput): SparkSolution[] {
    if (!params.coreProblem.trim()) return []
    const resources = params.knownResources?.filter(Boolean) ?? []
    const constraints = params.constraints?.filter(Boolean) ?? []
    return this.OPERATORS.map((op) => ({
      operatorId: op.id,
      operatorName: op.name,
      corePrinciple: op.principle,
      concretePlot:
        '针对「' +
        params.coreProblem +
        '」，目标「' +
        (params.protagonistGoal || '未提供') +
        '」，当前情况「' +
        (params.currentSituation || '未提供') +
        '」。' +
        op.question +
        (resources.length
          ? '可核对的已有筹码：' + resources.join('；') + '。'
          : '已有筹码尚未提供，先补充依据。') +
        (constraints.length
          ? '必须满足：' + constraints.join('；') + '。'
          : '不可改变的条件尚未提供。'),
      pros: '设计时核对：' + op.principle,
      cons:
        '对方条件「' +
        (params.enemyAdvantage || '未提供') +
        '」仍然有效。列出所需铺垫、失败分支和后续代价，作者确认后再采用。',
      twistImpact: 'subtle',
      status: 'creative_option',
      requiredSetup: [op.question],
      knownResources: resources,
      constraints,
    }))
  }
}
