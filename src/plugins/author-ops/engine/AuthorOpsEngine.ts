import type { MetricLogEntry, RetentionDropAnalysis } from "../types"

/**
 * AuthorOpsEngine (连载运营台账与作者商业名片引擎)
 *
 * 理论基础：追读留存率离散差分斜率梯度分析 grad = R(c) - R(c-1)
 * 当单章留存下降绝对值 >= 12% 时，判定为核心断崖流失点，输出策略推演
 */
export class AuthorOpsEngine {
  public static analyzeDropOff(logs: MetricLogEntry[]): RetentionDropAnalysis[] {
    if (logs.length < 2) return []

    const analyses: RetentionDropAnalysis[] = []

    for (let i = 1; i < logs.length; i++) {
      const prev = logs[i - 1]
      const curr = logs[i]

      const gradientLoss = prev.retentionRate - curr.retentionRate
      const isSevereCliff = gradientLoss >= 12

      let probableReason = "剧情节奏平淡，缺乏强冲突刺激"
      let recommendedCounterAction = "在下一章快速推进主线，加快打脸或揭晓悬念节奏"

      if (isSevereCliff) {
        probableReason = "疑似踩中核心毒点（送女/圣母/主角严重吃瘪）或断更导致大批读者退坑"
        recommendedCounterAction = "在最新章节末发布诚恳作话打补丁，并在后续剧情中迅速反转逆袭，安抚读者情绪"
      }

      analyses.push({
        dropOffChapter: curr.dropOffChapter,
        gradientLoss: Math.round(gradientLoss * 100) / 100,
        isSevereCliff,
        probableReason,
        recommendedCounterAction,
      })
    }

    return analyses.sort((a, b) => b.gradientLoss - a.gradientLoss)
  }

  /**
   * 格式化生成作者对外品牌赞赏与版权合作名片卡 Markdown
   */
  public static generateBusinessCard(
    authorName: string,
    bio: string,
    works: Array<{ title: string; genre: string; totalWords: number; status: string }>,
    supportUrl?: string
  ): string {
    const totalWords = works.reduce((sum, w) => sum + w.totalWords, 0)
    const workList = works
      .map((w) => `- **《${w.title}》** (${w.genre}) · ${Math.round(w.totalWords / 10000)}万字 [${w.status === "serialized" ? "连载中" : "已完结"}]`)
      .join("\n")

    return `# ✍️ 作家商业官方名片 · ${authorName}

> ${bio || "专注于打造极致心流商业网络文学作品。"}

### 📚 代表作品与版权资产 (累计创作 ${Math.round(totalWords / 10000)} 万字)
${workList || "- 暂无登记作品"}

### ☕ 读者赞赏与商务版权对接
${supportUrl ? `支持作者创作通道: [${supportUrl}](${supportUrl})` : "有声书、影视、动漫版权洽谈请联系站内编辑。"}`
  }
}
