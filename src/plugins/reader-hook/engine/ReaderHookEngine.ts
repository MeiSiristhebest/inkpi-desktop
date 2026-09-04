import type { HookAnalysisResult, HookTemplate, ReaderHookType, HookRating } from '../types'

const HOOK_PATTERNS: Array<{
  type: ReaderHookType
  baseScore: number
  keywords: string[]
  suggestions: string[]
}> = [
  {
    type: 'countdown',
    baseScore: 95,
    keywords: ['最后', '倒计时', '只剩', '仅剩', '刹那间', '命悬一线', '弹指间', '大阵将破'],
    suggestions: [
      '在倒计时临界点戛然而止（如“仅剩三息，但大门依然纹丝不动”）。',
      '将时间紧迫感与主角的生死绝境绑定，禁止在章尾交代脱险方案。',
    ],
  },
  {
    type: 'epiphany',
    baseScore: 90,
    keywords: ['原来', '竟是', '难道', '不可能', '真相', '赫然是', '看清了那张脸', '私印'],
    suggestions: [
      '在秘密揭晓最震撼的词眼处断句，让读者在惊愕中等待下回分解。',
      '制造身份或阵营的颠覆反转（如最信任的人竟是幕后黑手）。',
    ],
  },
  {
    type: 'battle_cut',
    baseScore: 88,
    keywords: ['拔剑', '剑芒', '刀光', '空气骤降', '死！', '一拳轰出', '天雷炸响', '杀意冲天'],
    suggestions: [
      '在双方底牌尽出、绝杀碰撞前一毫秒切断章节。',
      '描写对手惊骇欲绝的表情或无法置信的眼神，立刻结章。',
    ],
  },
  {
    type: 'crisis',
    baseScore: 82,
    keywords: ['突然', '不好！', '小心', '危险', '杀机', '剧痛', '鲜血喷出', '异变突生', '谁？！'],
    suggestions: [
      '引入不可控的第三方突发势力介入，打破原有的解决预期。',
      '让主角陷入被动受制局面，将最大的绝望感留存到下章开篇。',
    ],
  },
  {
    type: 'anomaly',
    baseScore: 75,
    keywords: ['诡异', '异样', '不对劲', '悄无声息', '血光', '幽幽', '冰冷的声音', '冷笑'],
    suggestions: [
      '强化环境视听细节的反常（如烛火突然转为绿色、身后多出一道影子）。',
      '用未知与阴森未解的氛围勾住读者探索欲。',
    ],
  },
  {
    type: 'question',
    baseScore: 68,
    keywords: ['？', '?', '是谁', '为何会这样', '怎会如此', '何去何从', '难道说'],
    suggestions: [
      '将内心的自我叩问转化为现实中的实质难题。',
      '把问句与高利害代价关联（如“若失败，满门尽绝，他该如何破局？”）。',
    ],
  },
]

const FLAT_CLOSURE_PATTERNS = [
  '沉沉睡去',
  '天色已晚',
  '相视一笑',
  '闭目养神',
  '一切归于平静',
  '洗漱一番',
  '长舒了一口气',
  '放下心来',
  '各自散去',
  '缓缓入定',
  '不表',
]

const PRESET_TEMPLATES: HookTemplate[] = [
  {
    id: 'tpl-epiphany',
    type: 'epiphany',
    name: '【认知颠覆】身份/真相反转',
    description: '在章尾揭开最不可思议的秘密，打破读者固化认知。',
    example: '借着微弱月光，他终于看清了黑衣人的真面目——那张脸上，赫然刻着三年前早已死去的兄长胎记！',
  },
  {
    id: 'tpl-battle-cut',
    type: 'battle_cut',
    name: '【战前截断】底牌碰撞临界',
    description: '蓄势达到最高潮、招式即将对撞瞬间切断，将期待感拉满。',
    example: '九天玄雷自苍穹悍然劈落，他拔出腰间锈剑，嘴角掀起一抹冷冽弧度：“这一剑，你接得下吗？”',
  },
  {
    id: 'tpl-countdown',
    type: 'countdown',
    name: '【致命倒计时】极限绝境死局',
    description: '数字化的生存倒计时，产生极强的情绪压迫感。',
    example: '血煞大阵的猩红光柱直冲云霄，玉简上的倒计时只剩最后三息，而通往生门唯一的钥匙，已在刚才彻底粉碎。',
  },
  {
    id: 'tpl-crisis',
    type: 'crisis',
    name: '【突发强敌】天降危机打破均势',
    description: '在主角刚刚松了一口气或获得胜利时，更庞大的黑影骤然降临。',
    example: '就在全场为他欢呼的刹那，整座大殿轰然坍塌，虚空裂开万里沟壑，一双遮天蔽日的血色巨眸缓缓睁开。',
  },
  {
    id: 'tpl-anomaly',
    type: 'anomaly',
    name: '【诡异异象】毛骨悚然的未知',
    description: '用不可解释的超自然或阴森异动，引爆读者的恐惧与好奇。',
    example: '房间里死一般寂静。他低头喝茶，却猛然发现，脚下的地面上，竟不知何时重叠着两具影子。',
  },
  {
    id: 'tpl-question',
    type: 'question',
    name: '【双重问责】两难抉择逼向悬崖',
    description: '将主角逼入道德、生存或阵营的绝境十字路口。',
    example: '一边是全城数十万生灵，一边是至亲挚爱的性命。天平两侧皆是深渊，他手中的剑，究竟该指向何方？',
  },
]

export class ReaderHookEngine {
  analyzeEnding(tailText: string): HookAnalysisResult {
    const text = (tailText || '').trim()
    if (!text || text.length < 5) {
      return {
        tensionScore: 20,
        hookType: 'question',
        rating: 'flat',
        feedback: '章尾字数过少或为空，无法建立有效的读者追读张力。',
        detectedKeywords: [],
        suggestions: ['在章节末尾至少留出 100-200 字进行悬念蓄势。'],
      }
    }

    // 提取末尾 300 字
    const slice = text.length > 300 ? text.slice(-300) : text

    const detectedKeywords: string[] = []
    let bestMatch = HOOK_PATTERNS[HOOK_PATTERNS.length - 1]
    let maxBase = 40

    // 检查各类钩子匹配
    for (const pat of HOOK_PATTERNS) {
      for (const kw of pat.keywords) {
        if (slice.includes(kw)) {
          detectedKeywords.push(kw)
          if (pat.baseScore > maxBase) {
            maxBase = pat.baseScore
            bestMatch = pat
          }
        }
      }
    }

    let score = maxBase

    // 末尾标点加分
    const lastChar = slice.slice(-1)
    if (lastChar === '?' || lastChar === '？') {
      score += 6
    } else if (lastChar === '!' || lastChar === '！') {
      score += 5
    } else if (slice.endsWith('……') || slice.endsWith('...')) {
      score += 5
    }

    // 检查平淡消解词 (扣分惩罚)
    let hasFlatClosure = false
    for (const flatKw of FLAT_CLOSURE_PATTERNS) {
      if (slice.includes(flatKw)) {
        hasFlatClosure = true
        score -= 28
        break
      }
    }

    // 限制在 [10, 100]
    score = Math.max(10, Math.min(100, score))

    let rating: HookRating = 'flat'
    let feedback = ''
    if (score >= 85) {
      rating = 'god_tier'
      feedback = '顶级断章！章尾张力拉满，冲突未决，极强激发读者追更欲望。'
    } else if (score >= 70) {
      rating = 'cliffhanger'
      feedback = '合格断章。具备良好戏剧冲突与悬念，追读转化率可期。'
    } else if (score >= 50) {
      rating = 'moderate'
      feedback = '常规平稳留白。剧情推进尚可，但章尾缺乏不可调和的即时危机感。'
    } else {
      rating = 'flat'
      feedback = hasFlatClosure
        ? '平淡收场！末尾出现了消解紧张感的话语，读者易心满意足关闭应用。'
        : '章尾张力较弱。缺乏明确疑问、突发变故或对决截断。'
    }

    return {
      tensionScore: score,
      hookType: bestMatch.type,
      rating,
      feedback,
      detectedKeywords,
      suggestions: bestMatch.suggestions,
    }
  }

  getTemplates(): HookTemplate[] {
    return PRESET_TEMPLATES
  }
}

export const readerHookEngine = new ReaderHookEngine()
