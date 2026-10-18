import type { ChapterSimulationResult, SimulatedComment, PersonaType } from '../types'

/** Vocabulary locates review questions; it cannot measure reader reactions or infer events. */
export class ReaderSimulatorEngine {
  private static readonly QUESTIONS: Array<{
    re: RegExp
    persona: PersonaType
    label: string
    question: string
  }> = [
    {
      re: /(跪下|磕头|受辱|自扇耳光|钻裤裆|受胯下之辱)/,
      persona: 'toxic_hunter',
      label: '角色能动性',
      question: '这是实际动作、否定、转述还是假设？若确实发生，角色的目标、选择和后果是否已交代？',
    },
    {
      re: /(原谅了他|不忍加害|放他离去|圣母|得饶人处且饶人|冤冤相报何时了)/,
      persona: 'toxic_hunter',
      label: '角色决策',
      question: '这是谁的决定或评价？前文是否交代动机、代价和边界？不能由该词项断定角色缺乏原则。',
    },
    {
      re: /(修为倒退|丹田破碎|沦为废人|根基尽毁|跌落凡尘)/,
      persona: 'pleasure_seeker',
      label: '成长线',
      question: '能力变化是否实际发生？是否服务于本作的目标和后续选择？读者偏好需要另行核验。',
    },
    {
      re: /(万里之遥.*半炷香|跨越大洲.*一眨眼|境界低于.*秒杀大乘)/,
      persona: 'logic_critic',
      label: '设定约束',
      question: '已给定的时间、距离、能力或例外是什么？缺少这些输入无法认定矛盾。',
    },
    {
      re: /(一剑破万法|杀伐果断|斩草除根|底牌尽出|神王陨落|全场死寂|震撼全场)/,
      persona: 'pleasure_seeker',
      label: '场景结果',
      question: '这是实际结果、夸张、台词还是预期？结果是否由已写出的行动与代价支持？',
    },
    {
      re: /(原来如此|伏笔|细思极恐|布局万载|惊天逆转|原来是你)/,
      persona: 'logic_critic',
      label: '信息揭示',
      question: '读者先前获得了什么信息？该句是否真的兑现了某个线索，还是仅提到了相关词项？',
    },
  ]

  static buildAnalysisInput(params: {
    chapterId: string
    chapterTitle: string
    chapterOrder: number
    sourceRevision?: number
    content: string
  }) {
    return {
      chapter: {
        id: params.chapterId,
        title: params.chapterTitle,
        order: params.chapterOrder,
        revision: params.sourceRevision ?? null,
      },
      text: params.content,
      readerProfiles: [
        { id: 'agency', preference: 'causal character choices and visible consequences' },
        { id: 'logic', preference: 'established constraints and consistent information' },
        {
          id: 'relationships',
          preference: 'motivated relationship changes and character autonomy',
        },
        {
          id: 'pacing',
          preference: 'progress toward the stated scene goal, allowing different genres',
        },
      ],
      reviewGoal:
        'For each interpretation, name the hypothetical profile, cite the supplied text and explain alternative readings. Respect negation, speaker attribution and missing prior context. No measured reaction, votes, scores or commercial prediction.',
    }
  }

  static simulateChapter(params: {
    chapterId: string
    chapterTitle: string
    chapterOrder: number
    sourceRevision?: number
    content: string
  }): ChapterSimulationResult {
    const { chapterId, chapterTitle, chapterOrder, sourceRevision, content } = params
    const comments: SimulatedComment[] = []
    for (const rule of this.QUESTIONS) {
      const match = rule.re.exec(content)
      if (!match) continue
      const sourceStart = Math.max(0, match.index - 50)
      const sourceEnd = Math.min(content.length, match.index + match[0].length + 50)
      comments.push({
        id: `question-${comments.length + 1}`,
        persona: rule.persona,
        authorName: rule.label,
        targetSnippet: content.slice(sourceStart, sourceEnd),
        sourceStart,
        sourceEnd,
        commentText: `原文包含“${match[0]}”。${rule.question}`,
        sentiment: 'review_question',
      })
    }
    return {
      chapterId,
      chapterTitle,
      chapterOrder,
      sourceRevision,
      comments,
      toxicAlerts: [],
      suggestions: [],
    }
  }
}
