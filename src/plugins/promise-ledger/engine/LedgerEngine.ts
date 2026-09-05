// 3P 伏笔与债务账本核心算法引擎
// 契诃夫之枪生命周期监测、记忆衰减模型、债务超期告警与叙事健康度评估

import type {
  PromiseLedgerEntry,
  DebtSnapshot,
  PayoffCandidate,
  PromiseTier,
} from '../types'

export const TIER_WEIGHTS: Record<PromiseTier, number> = {
  main_plot: 5.0,
  power_system: 3.5,
  romance: 2.5,
  side_arc: 1.5,
  atmosphere: 0.8,
}

export class LedgerEngine {
  /**
   * 读者记忆热度模型：M(d) = H_0 * e^(-λ * d)
   * 考虑历史推进节点 (Progress) 的热度重置/提振
   */
  public computeMemoryHeat(entry: PromiseLedgerEntry, currentChapter: number): number {
    const lambda = entry.memoryDecayLambda > 0 ? entry.memoryDecayLambda : 0.05
    if (currentChapter <= entry.plantChapter) {
      return 1.0
    }

    // 筛选出在当前章节或之前的所有推进历史，按章节升序排列
    const validProgresses = (entry.progressHistory || [])
      .filter((p) => p.chapter <= currentChapter && p.chapter >= entry.plantChapter)
      .sort((a, b) => a.chapter - b.chapter)

    let lastChapter = entry.plantChapter
    let currentHeat = 1.0

    for (const prog of validProgresses) {
      const delta = prog.chapter - lastChapter
      currentHeat = currentHeat * Math.exp(-lambda * delta)
      // 推进节点带来的热度提升（最高回满至 1.0）
      currentHeat = Math.min(1.0, currentHeat + (prog.memoryBoost ?? 0.5))
      lastChapter = prog.chapter
    }

    // 从最近一次推进点衰减到当前章节
    const finalDelta = currentChapter - lastChapter
    currentHeat = currentHeat * Math.exp(-lambda * finalDelta)

    return Math.max(0.0, Math.min(1.0, Number(currentHeat.toFixed(3))))
  }

  /**
   * 计算指定章节上下文下所有伏笔的债务快照
   */
  public computeDebtSnapshot(
    entries: PromiseLedgerEntry[],
    currentChapter: number,
  ): DebtSnapshot[] {
    return entries.map((entry) => {
      const elapsed = Math.max(0, currentChapter - entry.plantChapter)
      const isClosed = entry.status === 'paid_off' || entry.status === 'abandoned'
      const memoryHeat = this.computeMemoryHeat(entry, currentChapter)

      if (isClosed) {
        return {
          entry,
          elapsedChapters: elapsed,
          isOverdue: false,
          isWarning: false,
          memoryHeat,
          urgencyScore: 0,
        }
      }

      const isOverdue = elapsed >= entry.dueChapterLimit
      const isWarning = !isOverdue && elapsed >= entry.softDeadline
      const tierWeight = TIER_WEIGHTS[entry.tier] || 1.0

      let urgencyScore = 0
      if (isOverdue) {
        const overdueDistance = elapsed - entry.dueChapterLimit
        urgencyScore = (100 + overdueDistance * 10) * tierWeight
      } else if (isWarning) {
        const warnSpan = Math.max(1, entry.dueChapterLimit - entry.softDeadline)
        const progressInWarn = (elapsed - entry.softDeadline) / warnSpan
        urgencyScore = Math.round(progressInWarn * 50 * tierWeight)
      }

      // 数值溢出硬保护：将单项 urgencyScore 夹紧至合理范围 [0, 1000]，杜绝极端权重下爆表
      const clampedUrgency = Math.max(0, Math.min(1000, Math.round(urgencyScore)))

      return {
        entry,
        elapsedChapters: elapsed,
        isOverdue,
        isWarning,
        memoryHeat,
        urgencyScore: clampedUrgency,
      }
    })
  }

  /**
   * 自动探测正文中的可能兑现信号（关键词命中）
   */
  public detectPayoffCandidates(
    text: string,
    entries: PromiseLedgerEntry[],
  ): PayoffCandidate[] {
    if (!text || text.trim().length === 0) return []

    const candidates: PayoffCandidate[] = []
    const openEntries = entries.filter(
      (e) => e.status === 'planted' || e.status === 'progressing',
    )

    for (const entry of openEntries) {
      const clue = entry.clueName.trim()
      if (!clue) continue

      if (text.includes(clue)) {
        candidates.push({
          entryId: entry.id,
          clueName: clue,
          matchedKeyword: clue,
          confidence: 1.0,
        })
      } else {
        // 分词提取（长度 >= 2 的核心词）
        const subWords = clue
          .split(/[\s,，、。:：;；—\-()（）]+/)
          .filter((w) => w.length >= 2)

        for (const word of subWords) {
          if (text.includes(word)) {
            candidates.push({
              entryId: entry.id,
              clueName: clue,
              matchedKeyword: word,
              confidence: Number((word.length / clue.length).toFixed(2)),
            })
            break
          }
        }
      }
    }

    return candidates
  }

  /**
   * 叙事健康度评估：综合未回收伏笔的超期程度与重要度层级
   * 返回分值 0 ~ 100（100 表示极其健康无拖欠债务）
   */
  public computeNarrativeHealthScore(
    entries: PromiseLedgerEntry[],
    currentChapter: number,
  ): number {
    const snapshots = this.computeDebtSnapshot(entries, currentChapter)
    const activeSnapshots = snapshots.filter(
      (s) => s.entry.status === 'planted' || s.entry.status === 'progressing',
    )

    if (activeSnapshots.length === 0) return 100

    let totalPenalty = 0
    for (const s of activeSnapshots) {
      if (s.isOverdue) {
        totalPenalty += Math.min(30, (s.urgencyScore / 100) * 15)
      } else if (s.isWarning) {
        totalPenalty += Math.min(10, (s.urgencyScore / 100) * 5)
      }
      // 记忆热度过低惩罚
      if (s.memoryHeat < 0.2) {
        totalPenalty += 3
      }
    }

    const finalScore = Math.max(0, Math.min(100, Math.round(100 - totalPenalty)))
    return finalScore
  }
}

export const ledgerEngine = new LedgerEngine()
