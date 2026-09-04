import type {
  ShadowSimulationResult,
} from "../types"

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
export class ShadowReaderEngine {
  public static simulate(
    chapterText: string,
    chapterId: string
  ): ShadowSimulationResult {
    const paragraphs = chapterText.split(/\r?\n/).map((p) => p.trim()).filter((p) => p.length > 0)
    const danmakus: ShadowSimulationResult["danmakus"] = []

    let toxicAlertCount = 0
    let rage = 0
    let applause = 0
    let suspicious = 0
    let excited = 0

    paragraphs.forEach((para, pIdx) => {
      // 1. 爽感体验党检测：主角窝囊/圣母/受气毒点
      if (/(忍气吞声|跪下|赔礼道歉|算了吧|原谅了他|不计前嫌|退一步海阔天空)/.test(para)) {
        toxicAlertCount++
        rage++
        danmakus.push({
          chapterId,
          paragraphIndex: pIdx,
          personaType: "power_fantasy",
          personaName: "暴躁爽感老哥",
          content: "毒死我了！主角怎么这么圣母？被欺负成这样还原谅？直接弃书！",
          sentiment: "toxic_rage",
          isToxicAlert: true,
          toxicCategory: "weak_protagonist",
        })
      }

      // 2. 磕糖CP党检测：送女/绿帽/虐女反思
      if (/(转赠他人|献给公子|与他人结为连理|默默看着她离去)/.test(para)) {
        toxicAlertCount++
        rage++
        danmakus.push({
          chapterId,
          paragraphIndex: pIdx,
          personaType: "romance_shipper",
          personaName: "纯爱战神CP粉",
          content: "警告！作者这是在危险边缘试探吗？女主要送人了吗？别搞牛头人啊！",
          sentiment: "toxic_rage",
          isToxicAlert: true,
          toxicCategory: "cuckold_fear",
        })
      }

      // 3. 挑刺毒舌党：战力与逻辑漏洞
      if (/(越级斩杀|随手一拳轰碎星辰|明明是练气期)/.test(para)) {
        suspicious++
        danmakus.push({
          chapterId,
          paragraphIndex: pIdx,
          personaType: "critical_toxic",
          personaName: "杠精大毒舌",
          content: "经典战力崩坏，前文不是说大境界如鸿沟吗？这就随手秒了？",
          sentiment: "suspicious",
          isToxicAlert: false,
        })
      }

      // 4. 剧情推理党：伏笔猜想
      if (/(黑衣人|神秘微笑|目光微闪|当年的密信)/.test(para)) {
        suspicious++
        danmakus.push({
          chapterId,
          paragraphIndex: pIdx,
          personaType: "plot_detective",
          personaName: "大侦探福尔摩斯",
          content: "破案了！这个黑衣人大概率是主角的三叔，前面第5章提到过信件！",
          sentiment: "suspicious",
          isToxicAlert: false,
        })
      }

      // 5. 正向高潮反馈：爽感爆发
      if (/(一剑封喉|全场寂静|震撼全场|倒吸一口凉气|这怎么可能)/.test(para)) {
        excited++
        applause++
        danmakus.push({
          chapterId,
          paragraphIndex: pIdx,
          personaType: "power_fantasy",
          personaName: "吃瓜爽友",
          content: "卧槽爽！终于反杀了！经典倒吸凉气，这味太冲了爱看！",
          sentiment: "excited",
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
