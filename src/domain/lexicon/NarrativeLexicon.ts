/**
 * 统一网文叙事语境词库与多维语义模型 (Unified Narrative Lexicon & Semantics)
 *
 * 第一性原理与设计哲学：
 * 同一个修辞或桥段在不同篇章位置与行文结构中承担截然不同的叙事功能：
 * 1. 在正文铺垫期 (Body Window)：大段“倒吸凉气/瞳孔骤缩”属于无实质推进的【戏剧反应套话 (DRAMATIC_TENSION_CLICHE)】或【假动作水词 (PHANTOM_ACTION)】；
 * 2. 在章尾断章窗口 (Hook Window，如最后 300 字)：短促的突变套话则能够瞬间拉满读者心理悬念，构成合法的【章末张力钩子 (CLIFFHANGER_TRIGGER)】；
 * 3. 无论何处出现，“众所周知/正如前文所说”均属于纯粹的【设定重述水词 (PURE_FILLER_RECAP)】。
 *
 * 本模块统一词汇定义，为 water-meter、paywall-sentry、reader-hook 等插件提供一致的语义判定基准。
 */

export type SemanticCategory =
  | 'DRAMATIC_TENSION_CLICHE' // 戏剧性情绪反应套话（正文中为套话，章尾可作为悬念辅助标记）
  | 'PURE_FILLER_RECAP'      // 设定重述与前情口播（全局视为冗余水文）
  | 'MODIFIER_STACK'         // 程度副词过度堆砌
  | 'SUSPENSE_TRIGGER'       // 强转折与悬念启动词（黄金卡点/断章核心标志）
  | 'POWER_CLIMAX'           // 战力与爽点高潮动词
  | 'ACTION_ADVANCE'         // 推进剧情的具象物理动作动词

export interface NarrativeLexiconEntry {
  phrase: string
  category: SemanticCategory
  /**
   * 基础水分惩罚分值 (0 ~ 10)
   */
  bloatWeight: number
  /**
   * 作为章末悬念钩子的张力增益 (0 ~ 10)
   */
  hookPotential: number
  description: string
}

export const UNIFIED_NARRATIVE_LEXICON: NarrativeLexiconEntry[] = [
  // 戏剧性情绪反应套话 (正文减分，章尾可增益)
  {
    phrase: '倒吸了一口凉气',
    category: 'DRAMATIC_TENSION_CLICHE',
    bloatWeight: 7,
    hookPotential: 6,
    description: '公式化震惊反应',
  },
  {
    phrase: '倒吸一口凉气',
    category: 'DRAMATIC_TENSION_CLICHE',
    bloatWeight: 7,
    hookPotential: 6,
    description: '公式化震惊反应',
  },
  {
    phrase: '深吸了一口气',
    category: 'DRAMATIC_TENSION_CLICHE',
    bloatWeight: 5,
    hookPotential: 4,
    description: '情绪调节假动作',
  },
  {
    phrase: '深吸一口气',
    category: 'DRAMATIC_TENSION_CLICHE',
    bloatWeight: 5,
    hookPotential: 4,
    description: '情绪调节假动作',
  },
  {
    phrase: '瞳孔骤然收缩',
    category: 'DRAMATIC_TENSION_CLICHE',
    bloatWeight: 6,
    hookPotential: 8,
    description: '危机突现生理反应',
  },
  {
    phrase: '瞳孔骤缩',
    category: 'DRAMATIC_TENSION_CLICHE',
    bloatWeight: 6,
    hookPotential: 8,
    description: '危机突现生理反应',
  },
  {
    phrase: '瞳孔微缩',
    category: 'DRAMATIC_TENSION_CLICHE',
    bloatWeight: 5,
    hookPotential: 6,
    description: '警觉反应',
  },
  {
    phrase: '脸色剧变',
    category: 'DRAMATIC_TENSION_CLICHE',
    bloatWeight: 5,
    hookPotential: 7,
    description: '情绪失衡',
  },
  {
    phrase: '心中掀起惊涛骇浪',
    category: 'DRAMATIC_TENSION_CLICHE',
    bloatWeight: 8,
    hookPotential: 5,
    description: '夸张内心活动',
  },
  {
    phrase: '掀起滔天骇浪',
    category: 'DRAMATIC_TENSION_CLICHE',
    bloatWeight: 8,
    hookPotential: 5,
    description: '夸张内心活动',
  },
  {
    phrase: '整个人都不好了',
    category: 'DRAMATIC_TENSION_CLICHE',
    bloatWeight: 9,
    hookPotential: 1,
    description: '出戏网络梗',
  },

  // 纯粹设定重述与前情水词 (任何位置皆为水文)
  {
    phrase: '众所周知',
    category: 'PURE_FILLER_RECAP',
    bloatWeight: 9,
    hookPotential: 0,
    description: '背景旁白口播',
  },
  {
    phrase: '正如前文所说',
    category: 'PURE_FILLER_RECAP',
    bloatWeight: 10,
    hookPotential: 0,
    description: '机械重述前文',
  },
  {
    phrase: '正如前文所言',
    category: 'PURE_FILLER_RECAP',
    bloatWeight: 10,
    hookPotential: 0,
    description: '机械重述前文',
  },
  {
    phrase: '前面说过',
    category: 'PURE_FILLER_RECAP',
    bloatWeight: 10,
    hookPotential: 0,
    description: '机械重述前文',
  },
  {
    phrase: '大家都知道',
    category: 'PURE_FILLER_RECAP',
    bloatWeight: 8,
    hookPotential: 0,
    description: '说教口吻',
  },
  {
    phrase: '在整个修仙界中',
    category: 'PURE_FILLER_RECAP',
    bloatWeight: 7,
    hookPotential: 0,
    description: '宏观泛指垫话',
  },
  {
    phrase: '在修仙界中',
    category: 'PURE_FILLER_RECAP',
    bloatWeight: 6,
    hookPotential: 0,
    description: '宏观泛指垫话',
  },
  {
    phrase: '按常理来说',
    category: 'PURE_FILLER_RECAP',
    bloatWeight: 7,
    hookPotential: 0,
    description: '无效逻辑铺垫',
  },
  {
    phrase: '毋庸置疑',
    category: 'PURE_FILLER_RECAP',
    bloatWeight: 6,
    hookPotential: 0,
    description: '说明文强调词',
  },

  // 程度副词堆叠
  {
    phrase: '非常非常',
    category: 'MODIFIER_STACK',
    bloatWeight: 8,
    hookPotential: 0,
    description: '单调副词堆叠',
  },
  {
    phrase: '极其极其',
    category: 'MODIFIER_STACK',
    bloatWeight: 8,
    hookPotential: 0,
    description: '单调副词堆叠',
  },
  {
    phrase: '万万万万',
    category: 'MODIFIER_STACK',
    bloatWeight: 8,
    hookPotential: 0,
    description: '单调副词堆叠',
  },
  {
    phrase: '不可思议的极其',
    category: 'MODIFIER_STACK',
    bloatWeight: 9,
    hookPotential: 0,
    description: '语病式层叠',
  },
]

/**
 * 经典悬念/突变触发词（章末卡点核心加分项）
 */
export const SUSPENSE_TRIGGER_WORDS = [
  '忽然', '突然', '骤然', '猛地', '然而', '只见', '竟然', '赫然',
  '怎么可能', '不可能', '那是……', '那是...', '谁？！', '谁?!', '危险', '崩塌', '杀意',
  '脚步一顿', '原来是你', '秘密', '真相', '阴谋',
]

/**
 * 核心动作推进动词
 */
export const CORE_ACTION_VERBS = [
  '斩', '杀', '刺', '夺', '踏', '破', '劈', '跃', '冲', '遁',
  '袭', '擒', '铸', '炼', '崩', '撕', '截', '轰', '击', '奔',
  '拔', '战', '扣', '掷', '抓', '按', '撞', '射', '爆', '掠',
]

export class NarrativeLexiconService {
  /**
   * 根据文本所处结构位置（正文区间 vs 章尾卡点区间），判定词汇的情感张力与水分
   */
  public static evaluatePhrase(
    phrase: string,
    isAtChapterTail: boolean,
  ): { bloatPenalty: number; hookBenefit: number; category?: SemanticCategory } {
    const entry = UNIFIED_NARRATIVE_LEXICON.find((e) => e.phrase === phrase)
    if (!entry) {
      return { bloatPenalty: 0, hookBenefit: 0 }
    }

    if (entry.category === 'PURE_FILLER_RECAP' || entry.category === 'MODIFIER_STACK') {
      return {
        bloatPenalty: entry.bloatWeight,
        hookBenefit: 0,
        category: entry.category,
      }
    }

    if (entry.category === 'DRAMATIC_TENSION_CLICHE') {
      if (isAtChapterTail) {
        // 在章尾 25% 或最后 300 字，套话的水分惩罚削减 70%，悬念价值生效
        return {
          bloatPenalty: Math.round(entry.bloatWeight * 0.3),
          hookBenefit: entry.hookPotential,
          category: entry.category,
        }
      }
      return {
        bloatPenalty: entry.bloatWeight,
        hookBenefit: 0,
        category: entry.category,
      }
    }

    return { bloatPenalty: 0, hookBenefit: entry.hookPotential, category: entry.category }
  }
}
