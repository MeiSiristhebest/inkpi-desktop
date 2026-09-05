import type { ShadowSimulationResult } from '../types'

/**
 * ShadowReaderEngine (读者弹幕与毒点预判模拟器引擎)
 *
 * 理论基础：5 大典型网文读者认知肖像模型 (Reader Personas)
 * 1. 挑刺毒舌党 (critical_toxic): 挑逻辑漏洞与战力崩溃
 * 2. 剧情推理党 (plot_detective): 抓线索与猜幕后黑手
 * 3. 磕糖CP党 (romance_shipper): 盯感情线与防送女
 * 4. 爽感体验党 (power_fantasy): 极度敏感主角受气与圣母行径
 * 5. 设定考据党 (lore_scholar): 抓世界观常识与等级称谓
 */
/**
 * ShadowReaderEngine (读者弹幕与毒点预判模拟器引擎)
 *
 * 理论基础：5 大典型网文读者认知肖像模型 (Reader Personas)
 * 1. 挑刺毒舌党 (critical_toxic): 挑逻辑漏洞与战力崩溃
 * 2. 剧情推理党 (plot_detective): 抓线索与猜幕后黑手
 * 3. 磕糖CP党 (romance_shipper): 盯感情线与防送女
 * 4. 爽感体验党 (power_fantasy): 极度敏感主角受气与圣母行径
 * 5. 设定考据党 (lore_scholar): 抓世界观常识与等级称谓
 *
 * 演进设计：
 * 支持 Prompt 导向的 Agentic 认知推理，与基于段落语义上下文切片的自适应动态弹幕生成。
 */
export class ShadowReaderEngine {
  /**
   * 生成大模型读者推演结构化 Prompt（用于通过 AiAssistant 端口实现真正的大模型读者群像推演）
   */
  public static buildAiPrompt(chapterTitle: string, chapterText: string): string {
    return [
      `【指令：全真读者群像心智模拟】`,
      `你是一位拥有十年网文阅读经验的读者群推演专家，请代入 5 大典型网文读者肖像对以下章节段落进行真实、具有网感、切合上下文的段评推演：`,
      `1. 暴躁爽感老哥 (power_fantasy)：对主角憋屈、圣母、放虎归山极度敏感`,
      `2. 纯爱战神CP粉 (romance_shipper)：对虐女、送女、移情别恋警觉`,
      `3. 杠精大毒舌 (critical_toxic)：抓战力崩溃、时空逻辑硬伤`,
      `4. 大侦探考据党 (plot_detective)：分析剧情细节、伏笔与暗线推演`,
      `5. 催更吃瓜群众 (pleasure_seeker)：高潮喝彩、期待后续`,
      ``,
      `章节：《${chapterTitle || '未命名章节'}》`,
      `正文片段：`,
      chapterText.slice(0, 2000),
      ``,
      `请按 JSON 数组格式输出 5-8 条段评：[{ "paragraphIndex": number, "persona": string, "authorName": string, "commentText": string, "sentiment": "rage"|"applause"|"suspicious"|"excited", "isToxic": boolean }]`,
    ].join('\n')
  }

  public static simulate(
    chapterText: string,
    chapterId: string,
    _options?: {
      genreContext?: 'cultivation' | 'scifi' | 'urban' | 'fantasy' | 'general'
      customPersonas?: string[]
    },
  ): ShadowSimulationResult {
    const paragraphs = chapterText
      .split(/\r?\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
    const danmakus: ShadowSimulationResult['danmakus'] = []

    let toxicAlertCount = 0
    let rage = 0
    let applause = 0
    let suspicious = 0
    let excited = 0

    // 针对段落语义特征提取动态上下文切片，告别生硬复读
    paragraphs.forEach((para, pIdx) => {
      const paraSnippet = para.slice(0, 25)

      // 1. 爽感体验党检测：主角妥协/受气/无故宽恕
      const weakMatch = para.match(
        /(忍气吞声|跪下|赔礼道歉|算了吧|原谅了他|不计前嫌|退一步海阔天空|不忍加害|饶恕|息事宁人)/,
      )
      if (weakMatch) {
        toxicAlertCount++
        rage++
        danmakus.push({
          chapterId,
          paragraphIndex: pIdx,
          personaType: 'power_fantasy',
          personaName: '暴躁爽感老哥',
          content: `毒死我了！看到“${paraSnippet}...”这里真血压拉满了，主角“${weakMatch[0]}”无原则圣母必遭反噬，怒弃书！`,
          sentiment: 'toxic_rage',
          isToxicAlert: true,
          toxicCategory: 'weak_protagonist',
        })
      }

      // 2. 情感线纯爱党：送女/暧昧转赠风险
      const romanceMatch = para.match(
        /(转赠他人|献给公子|与他人结为连理|默默看着她离去|拱手相让|另寻良配)/,
      )
      if (romanceMatch) {
        toxicAlertCount++
        rage++
        danmakus.push({
          chapterId,
          paragraphIndex: pIdx,
          personaType: 'romance_shipper',
          personaName: '纯爱战神CP粉',
          content: `“${romanceMatch[0]}”这一出是在试探读者底线？感情线交代不清容易引起弃书暴雷！`,
          sentiment: 'toxic_rage',
          isToxicAlert: true,
          toxicCategory: 'cuckold_fear',
        })
      }

      // 3. 挑刺毒舌党：境界/数值飞跃或逻辑跳跃
      const logicMatch = para.match(
        /(越级斩杀|随手一拳轰碎星辰|明明是练气期|瞬间横跨|眨眼间突破|毫无悬念地秒杀)/,
      )
      if (logicMatch) {
        suspicious++
        danmakus.push({
          chapterId,
          paragraphIndex: pIdx,
          personaType: 'critical_toxic',
          personaName: '杠精大毒舌',
          content: `“${logicMatch[0]}”有点离谱了，前文设定的境界壁垒和体量怎么自洽？考据党表示很出戏。`,
          sentiment: 'suspicious',
          isToxicAlert: false,
        })
      }

      // 4. 剧情推理党：伏笔与细节
      const clueMatch = para.match(
        /(黑衣人|神秘微笑|目光微闪|当年的密信|暗中布局|蛛丝马迹|异样波动)/,
      )
      if (clueMatch) {
        suspicious++
        danmakus.push({
          chapterId,
          paragraphIndex: pIdx,
          personaType: 'plot_detective',
          personaName: '大侦探福尔摩斯',
          content: `注意这一句“${clueMatch[0]}”！结合前文伏笔，此处的微动作大概率是反转先兆。`,
          sentiment: 'suspicious',
          isToxicAlert: false,
        })
      }

      // 5. 正向高潮反馈：高光反击与爽点
      const climaxMatch = para.match(
        /(一剑封喉|全场寂静|震撼全场|倒吸一口凉气|这怎么可能|死寂|底牌尽显|神色骤变)/,
      )
      if (climaxMatch) {
        excited++
        applause++
        danmakus.push({
          chapterId,
          paragraphIndex: pIdx,
          personaType: 'power_fantasy',
          personaName: '吃瓜爽友',
          content: `卧槽爽！“${climaxMatch[0]}”这波全场震撼倒吸凉气，压抑之后的高光反杀太解渴了！`,
          sentiment: 'excited',
          isToxicAlert: false,
        })
      }
    })

    return {
      danmakus,
      toxicAlertCount,
      sentimentSummary: { rage, applause, suspicious, excited },
    }
  }
}
