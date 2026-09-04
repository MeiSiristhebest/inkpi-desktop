import type { ChekhovRadarStats, PlantGunSuggestion, ChekhovGunRecord } from '../types'
import { pluginEventBus } from '../../../core/pluginEventBus'

export class ChekhovRadarEngine {
  /**
   * 伏笔锈蚀半衰期阈值：超过 30 章未引爆且仍未回收
   */
  static readonly RUSTING_THRESHOLD = 30

  /**
   * 计算伏笔全景统计与锈蚀健康度
   */
  static computeStats(guns: ChekhovGunRecord[], currentMaxChapterOrder: number): ChekhovRadarStats {
    const totalGuns = guns.length
    if (totalGuns === 0) {
      return {
        totalGuns: 0,
        firedCount: 0,
        dormantCount: 0,
        incubatingCount: 0,
        rustingCount: 0,
        closureRate: 100,
        healthGrade: 'EXCELLENT',
      }
    }

    let firedCount = 0
    let dormantCount = 0
    let incubatingCount = 0
    let rustingCount = 0

    for (const gun of guns) {
      if (gun.status === 'fired') {
        firedCount++
      } else {
        if (gun.status === 'dormant') dormantCount++
        if (gun.status === 'incubating') incubatingCount++

        const dist = Math.max(0, currentMaxChapterOrder - gun.plantChapterOrder)
        if (dist >= this.RUSTING_THRESHOLD && gun.status !== 'abandoned') {
          rustingCount++
        }
      }
    }

    const closureRate = Math.round((firedCount / totalGuns) * 100)
    let healthGrade: 'EXCELLENT' | 'GOOD' | 'WARNING' | 'DANGER' = 'EXCELLENT'

    if (rustingCount >= 3 || (totalGuns >= 3 && closureRate < 35)) {
      healthGrade = 'DANGER'
    } else if (rustingCount >= 1 || closureRate < 60) {
      healthGrade = 'WARNING'
    } else if (closureRate < 80) {
      healthGrade = 'GOOD'
    }

    return {
      totalGuns,
      firedCount,
      dormantCount,
      incubatingCount,
      rustingCount,
      closureRate,
      healthGrade,
    }
  }

  /**
   * 自然语言特征与语义实体伏笔抽取器 (Semantic Foreshadow Extractor)
   */
  static detectPotentialGuns(text: string): PlantGunSuggestion[] {
    const suggestions: PlantGunSuggestion[] = []

    // 1. 器物与重宝伏笔特征 (残卷/玉佩/铜镜/古剑/断刃/指环/手镯/黑鼎/锦囊/印记)
    const itemMatch = text.match(/([\u4e00-\u9fa5]{2,8}(?:残卷|玉佩|铜镜|古剑|断刃|指环|手镯|黑鼎|锦囊|小鼎|骨片|道符|令牌))/g)
    if (itemMatch) {
      for (const item of itemMatch.slice(0, 3)) {
        suggestions.push({
          gunName: item,
          category: 'item',
          snippet: `正文中初次出现了神秘器物：${item}`,
          reason: '特殊器物具有极高辨识度与后手引爆价值，适合立为重要伏笔。',
        })
      }
    }

    // 2. 身世/秘密伏笔
    if (/(身世|遗言|灭门之谜|神秘印记|临终嘱托|失踪之谜)/.test(text)) {
      suggestions.push({
        gunName: '主角或配角身世之谜',
        category: 'secret',
        snippet: '正文中暗示了深层身份隐秘或未解谜团',
        reason: '主线身世悬念是驱动读者长期追读的核心发动机。',
      })
    }

    // 3. 誓言与承诺之约
    if (/(誓言|三年之后|定当登门|有朝一日|决战之日|不共戴天)/.test(text)) {
      suggestions.push({
        gunName: '期约与立誓之枪',
        category: 'promise',
        snippet: '正文中立下了明确的长期或中期行动誓约',
        reason: '契约承诺必须在未来高潮章予以履约回响。',
      })
    }

    return suggestions
  }

  /**
   * 检查是否在当前文本中提及了某个伏笔（呼应回收判定），若触发回收通过事件总线通知
   */
  static checkMentionedGuns(guns: ChekhovGunRecord[], text: string, projectId?: string): ChekhovGunRecord[] {
    const mentioned = guns.filter((gun) => {
      if (gun.status === 'fired' || gun.status === 'abandoned') return false
      return text.includes(gun.gunName)
    })

    // 若检测到提及且存在 projectId，发布跨插件伏笔呼应事件
    if (projectId && mentioned.length > 0) {
      for (const gun of mentioned) {
        pluginEventBus.emit('FORESHADOW_PLANTED', {
          projectId,
          gunName: gun.gunName,
          plantChapterOrder: gun.plantChapterOrder,
          category: gun.category,
        })
      }
    }

    return mentioned
  }
}
