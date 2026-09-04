import type { ChapterSimulationResult, SimulatedComment } from '../types'

export class ReaderSimulatorEngine {
  /**
   * 毒点规则库与典型触发特征（按心理学冲击强度与憋屈指数加权）
   */
  private static readonly TOXIC_PATTERNS = [
    {
      id: 'humiliation',
      re: /(跪下|磕头|受辱|自扇耳光|钻裤裆|受胯下之辱)/,
      basePenalty: 35,
      alert: '⚠️ 检测到高烈度受辱/下跪情节，若无立即反杀暗示，极易触发读者怒弃！',
      persona: 'toxic_hunter' as const,
      author: '十年老书虫_退订狂魔',
      generateComment: (snippet: string) => `这破剧情直接让主角下跪受辱？（“${snippet}”）作者你到底在写爽文还是写自虐？怒退订！`,
    },
    {
      id: 'over_merciful',
      re: /(原谅了他|不忍加害|放他离去|圣母|得饶人处且饶人|冤冤相报何时了)/,
      basePenalty: 28,
      alert: '⚠️ 检测到放虎归山/无原则宽恕情节，容易引发杀伐果断受众强烈反弹。',
      persona: 'toxic_hunter' as const,
      author: '杀伐果断真爱党',
      generateComment: (snippet: string) => `敌人杀人夺宝还要圣母原谅？（“${snippet}”）反派转头就叫老祖灭门，主角长点脑子吧！`,
    },
    {
      id: 'crippled_nerf',
      re: /(修为倒退|丹田破碎|沦为废人|根基尽毁|跌落凡尘)/,
      basePenalty: 30,
      alert: '⚠️ 检测到修为残废倒退情节，若无立即补偿爽点，代入感会剧烈受挫。',
      persona: 'pleasure_seeker' as const,
      author: '无敌推图流老哥',
      generateComment: (snippet: string) => `好不容易升级又被废丹田？（“${snippet}”）这波毒点直接劝退，不想看抑郁倒退剧情！`,
    },
    {
      id: 'physics_collapse',
      re: /(万里之遥.*半炷香|跨越大洲.*一眨眼|境界低于.*秒杀大乘)/,
      basePenalty: 20,
      alert: '⚠️ 疑似时空距离或战力跨度失真，容易被考据党纠错抓虫。',
      persona: 'logic_critic' as const,
      author: '修仙物理研究所所长',
      generateComment: (snippet: string) => `时空战力完全崩塌（“${snippet}”），前文刚设定万里迢迢，转眼就到，战力体系崩了！`,
    },
  ]

  /**
   * 积极惊叹与赞叹特征
   */
  private static readonly PRAISE_PATTERNS = [
    {
      re: /(一剑破万法|杀伐果断|斩草除根|底牌尽出|神王陨落|全场死寂|震撼全场)/,
      author: '催更第一名',
      generateComment: (snippet: string) => `卧槽！这波绝杀太帅了（“${snippet}”）！杀伐果断不废话，看得热血沸腾！`,
    },
    {
      re: /(原来如此|伏笔|细思极恐|布局万载|惊天逆转|原来是你)/,
      author: '列文虎克看网文',
      generateComment: (snippet: string) => `原来在这里收回了伏笔（“${snippet}”）！作者大纲功底真扎实，给大佬打赏！`,
    },
  ]

  /**
   * 模拟全章读者段评反应、毒点指数与逻辑健康度
   */
  static simulateChapter(params: {
    chapterId: string
    chapterTitle: string
    chapterOrder: number
    content: string
  }): ChapterSimulationResult {
    const { chapterId, chapterTitle, chapterOrder, content } = params

    let toxicityRaw = 10
    let logicRaw = 85
    let pleasureRaw = 40
    const toxicAlerts: string[] = []
    const comments: SimulatedComment[] = []

    // 1. 扫描毒点模式（动态结合命中片段生成真实上下文段评）
    let commentIdx = 1
    for (const pat of this.TOXIC_PATTERNS) {
      const globalRe = new RegExp(pat.re.source, 'g')
      const matches = content.match(globalRe)
      if (matches && matches.length > 0) {
        toxicityRaw += Math.min(45, matches.length * pat.basePenalty)
        logicRaw -= Math.min(25, matches.length * 10)
        toxicAlerts.push(pat.alert)

        // 抽取命中核心短语与其局部语境
        const snippetIndex = content.search(pat.re)
        const start = Math.max(0, snippetIndex - 12)
        const end = Math.min(content.length, snippetIndex + 20)
        const rawSnippet = content.slice(start, end).replace(/\s+/g, ' ').trim()

        comments.push({
          id: `cmt_${commentIdx++}`,
          persona: pat.persona,
          authorName: pat.author,
          targetSnippet: rawSnippet,
          commentText: pat.generateComment(matches[0]),
          sentiment: 'toxic_alert',
          upvotes: 89 + matches.length * 20,
        })
      }
    }

    // 2. 扫描爽点与称赞模式
    for (const pat of this.PRAISE_PATTERNS) {
      const globalRe = new RegExp(pat.re.source, 'g')
      const matches = content.match(globalRe)
      if (matches && matches.length > 0) {
        pleasureRaw += Math.min(50, matches.length * 25)
        const snippetIndex = content.search(pat.re)
        const start = Math.max(0, snippetIndex - 10)
        const end = Math.min(content.length, snippetIndex + 18)
        const rawSnippet = content.slice(start, end).replace(/\s+/g, ' ').trim()

        comments.push({
          id: `cmt_${commentIdx++}`,
          persona: 'pleasure_seeker',
          authorName: pat.author,
          targetSnippet: rawSnippet,
          commentText: pat.generateComment(matches[0]),
          sentiment: 'praise',
          upvotes: 156 + matches.length * 30,
        })
      }
    }

    // 兜底日常评论
    if (comments.length === 0) {
      comments.push({
        id: 'cmt_0',
        persona: 'pleasure_seeker',
        authorName: '追更日常党',
        targetSnippet: content.slice(0, 25).trim() || '本章开头',
        commentText: '大大更新辛苦了！剧情平稳过渡，期待后续爆更！',
        sentiment: 'praise',
        upvotes: 12,
      })
    }

    // 生成智能防杠建议
    const suggestions: string[] = []
    if (toxicityRaw > 40) {
      suggestions.push('建议在主角受制环节增加“暗中留有绝对反制底牌/传音后手”的伏笔描写，削弱憋屈感。')
    }
    if (logicRaw < 75) {
      suggestions.push('涉及大境界差距对决时，补充“法宝品阶压制”、“借用地脉大阵”等合理解释。')
    }
    if (pleasureRaw < 50) {
      suggestions.push('本章末尾推进过缓，可增添“敌人震惊倒吸凉气”或“神秘秘宝异动”增强追读欲望。')
    }

    return {
      chapterId,
      chapterTitle,
      chapterOrder,
      toxicityScore: Math.min(100, Math.max(0, toxicityRaw)),
      logicScore: Math.min(100, Math.max(0, logicRaw)),
      pleasureScore: Math.min(100, Math.max(0, pleasureRaw)),
      comments,
      toxicAlerts,
      suggestions,
    }
  }
}
