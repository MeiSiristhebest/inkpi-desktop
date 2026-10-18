import type { NarrativeArchetypeRecord, ArchetypeCategory, ChemistryResult } from '../types'
import type { RandomSource } from '../../../ports/randomSource'
import { randomSource as defaultRandomSource } from '../../../adapters/randomSource'

const CHARACTER_MATERIALS = [
  ['rebel', '反叛者', '改变阻碍目标的规则', '忽略规则保护的人', '公开提出异议'],
  ['ruler', '秩序维护者', '维持共同生活的秩序', '把程序置于个人处境之上', '解释规则与例外'],
  ['martyr', '承担者', '保护重要的人或目标', '替别人决定代价', '提出自己承担的成本'],
  ['egoist', '自保者', '保住自己的利益', '低估长期互惠关系', '明确拒绝不利交换'],
  ['mentor', '指导者', '传递经验', '替学习者做决定', '提出问题而非给结论'],
  ['trickster', '变通者', '改变僵化局面', '忽略他人的信任成本', '换一个问题的表述'],
  ['seeker', '探索者', '找到新的可能', '忽略已承担的责任', '检验陌生线索'],
  ['guardian', '守护者', '保护某个人或地方', '把保护变成控制', '询问被保护者的选择'],
  ['builder', '建造者', '完成可延续的成果', '忽视无法量化的需求', '安排可检验的步骤'],
  ['healer', '修复者', '缓解伤害与隔阂', '以善意代替同意', '先核对对方需要'],
  ['witness', '见证者', '保留真实经过', '把观察当成完整真相', '区分看到与听说'],
  ['messenger', '传递者', '让信息到达目标', '忽视传递的后果', '选择何时告知谁'],
  ['judge', '裁断者', '做出公平决定', '忽略证据的缺口', '听取不同证词'],
  ['bargainer', '协商者', '达成可接受的交换', '将重要关系当成交易', '提出交换条件'],
  ['artist', '创作者', '完成个人表达', '忽略合作的边界', '说明自己想保留的东西'],
  ['archivist', '记录者', '保存共同记忆', '把记录等同于现实', '核对记录与当前变化'],
  ['outsider', '外来者', '找到位置与归属', '误读群体习惯', '向不同成员求证'],
  ['heir', '继承者', '处理继承的责任', '照搬前人的选择', '重新确认承诺'],
  ['rival', '竞争者', '争取稀缺机会', '把竞争扩大到所有关系', '承认对手的条件'],
  ['companion', '同行者', '维持共同目标', '隐瞒自己的不同愿望', '提出继续同行的理由'],
  ['caretaker', '照料者', '维持他人的生活', '忽略自己的边界', '说明能承担多少'],
  ['skeptic', '怀疑者', '避免未经核对的判断', '将不确定等同于不可能', '提出可验证的问题'],
  ['believer', '信守者', '实践认定的价值', '忽略价值之间的冲突', '解释自己愿付的代价'],
  ['strategist', '规划者', '让长期计划成立', '低估临时变化', '列出计划的前提'],
  ['improviser', '即兴者', '应对眼前变化', '忽略后续成本', '检验手边能用的条件'],
  ['mediator', '调解者', '保留双方对话可能', '掩盖无法调和的诉求', '分别确认各自底线'],
  ['challenger', '挑战者', '证明某项能力或观点', '把失败看作身份否定', '定义可接受的结果'],
  ['refugee', '离开者', '重新获得生活条件', '回避旧责任的影响', '选择可依赖的新关系'],
  ['reformer', '改良者', '修正组织的问题', '低估受损者的反对', '提出可检验的改变'],
  ['inventor', '发明者', '解决尚无答案的问题', '把技术可行等同于适用', '测试失败情形'],
  ['keeper', '保管者', '守住托付的事物', '忘记托付的目的', '核对使用权限'],
  ['explainer', '解释者', '让彼此理解', '把自己的解释当成共识', '请对方复述理解'],
  ['performer', '表演者', '获得关注与回应', '依赖外部认可', '在无人观看时做选择'],
  ['organizer', '组织者', '协调共同任务', '忽略少数人的代价', '公开分工与退出条件'],
  ['survivor', '生存者', '保留下一步选择', '持续沿用旧危机的策略', '重新评估当前环境'],
  ['returner', '归来者', '处理过去与现在的关系', '假设一切仍然如前', '重新认识旧关系'],
]
const MOTIFS = [
  ['ordinary', '日常与既有秩序', '确认改变前的生活条件'],
  ['call', '新的要求', '提出一个角色不能忽视的问题'],
  ['refusal', '拒绝召唤', '记录拒绝的理由与代价'],
  ['mentor', '获得支持', '给帮助者独立的目标和限制'],
  ['threshold', '跨越边界', '说明选择后哪些条件改变'],
  ['tests', '试探与结盟', '通过行动核对关系'],
  ['approach', '接近核心问题', '列出尚缺的条件'],
  ['abyss', '深渊试炼', '使目标、底线或认识接受检验'],
  ['reward', '取得成果', '保留取得成果的成本'],
  ['return', '返回与后果', '处理变化如何影响原有生活'],
  ['renewal', '再次选择', '让人物在相似压力下做新选择'],
  ['sharing', '带回与分享', '明确成果的受益者与损失承担者'],
]
export class ArchetypeEngine {
  private readonly randomSource: RandomSource
  constructor(random?: RandomSource) {
    this.randomSource = random ?? defaultRandomSource
  }
  static getPresetArchetypes(): NarrativeArchetypeRecord[] {
    const characters: NarrativeArchetypeRecord[] = CHARACTER_MATERIALS.map(
      ([id, name, goal, flaw, action]) => ({
        id: 'arch-' + id,
        name,
        category: 'character_archetype_36',
        coreDesire: goal,
        fatalFlaw: flaw,
        typicalBehaviors: [action],
        foilArchetypeIds: [],
        conflictPrompt:
          '在「' + goal + '」与他人的目标发生分歧时，谁承担成本？有哪些协商、拒绝或合作的选择？',
      }),
    )
    const motifs: NarrativeArchetypeRecord[] = MOTIFS.map(([id, name, prompt]) => ({
      id: 'motif-' + id,
      name,
      category: 'narrative_motif_12',
      coreDesire: prompt,
      fatalFlaw: '若与人物目标无关，考虑不用此母题。',
      typicalBehaviors: [],
      foilArchetypeIds: [],
      conflictPrompt: prompt + '；不要求故事依序使用全部母题。',
    }))
    const labels: NarrativeArchetypeRecord[] = [
      'INTJ',
      'INTP',
      'ENTJ',
      'ENTP',
      'INFJ',
      'INFP',
      'ENFJ',
      'ENFP',
      'ISTJ',
      'ISFJ',
      'ESTJ',
      'ESFJ',
      'ISTP',
      'ISFP',
      'ESTP',
      'ESFP',
    ].map((type) => ({
      id: 'label-' + type,
      name: type + '（可选创作标签）',
      category: 'mbti_matrix',
      coreDesire: '由作者填写角色的具体目标',
      fatalFlaw: '标签不能代替具体行为和处境',
      typicalBehaviors: [],
      foilArchetypeIds: [],
      conflictPrompt:
        '为此角色写一个实际选择，再比较他在另一种处境下的选择；不要由标签推断必然行为。',
    }))
    const conflicts: NarrativeArchetypeRecord[] = [
      '共同资源不足',
      '公开事实与保守承诺',
      '短期责任与长期计划',
      '个人选择与集体程序',
      '旧关系与新任务',
      '分工与代价不对等',
      '信息不完整',
      '成果归属不同',
    ].map((name, i) => ({
      id: 'conflict-' + i,
      name,
      category: 'conflict_deck',
      coreDesire: '明确各方想保留的条件',
      fatalFlaw: '不能凭冲突卡替人物决定立场',
      typicalBehaviors: [],
      foilArchetypeIds: [],
      conflictPrompt: '围绕「' + name + '」，为双方分别填写目标、底线、已知信息与可承担的代价。',
    }))
    return [...characters, ...labels, ...motifs, ...conflicts]
  }
  drawCards(
    category: ArchetypeCategory,
    count = 1,
    pool?: NarrativeArchetypeRecord[],
  ): NarrativeArchetypeRecord[] {
    if (!Number.isInteger(count) || count < 0 || count > 100)
      throw new Error('抽卡数量必须为 0–100 的整数。')
    const list = (pool ?? ArchetypeEngine.getPresetArchetypes()).filter(
      (card) => card.category === category,
    )
    if (new Set(list.map((c) => c.id)).size !== list.length) throw new Error('素材 ID 重复。')
    const drawn: NarrativeArchetypeRecord[] = []
    for (let i = 0; i < count && list.length; i++) {
      const random = this.randomSource.next()
      if (!Number.isFinite(random) || random < 0 || random >= 1)
        throw new Error('随机源必须返回 [0,1) 内的有限数。')
      drawn.push(structuredClone(list.splice(Math.floor(random * list.length), 1)[0]))
    }
    return drawn
  }
  static calculateChemistry(
    charA: NarrativeArchetypeRecord,
    charB: NarrativeArchetypeRecord,
  ): ChemistryResult {
    const sufficient = Boolean(charA.coreDesire.trim() && charB.coreDesire.trim())
    return {
      archetypeA: structuredClone(charA),
      archetypeB: structuredClone(charB),
      coreEthicalConflict: sufficient
        ? '目标 A：「' + charA.coreDesire + '」；目标 B：「' + charB.coreDesire + '」。'
        : '角色目标资料不足。',
      dramaticPrompt: sufficient
        ? '可选场景：让双方决定一项共享资源或行动的用途。先记录共同目标、不同底线和各自掌握的信息，再选择协商、合作或拒绝；结果由具体处境决定。'
        : '先为双方填写目标、关系与场景条件，再讨论对手戏。',
    }
  }
}
