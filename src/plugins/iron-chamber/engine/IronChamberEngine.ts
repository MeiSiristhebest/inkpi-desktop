import type {
  ChamberStatus,
  IronChamberRecord,
  LockProgress,
} from "../types"

/**
 * IronChamberEngine (黑曜石小黑屋锁定器引擎)
 *
 * 理论基础：心流承诺契约模型 (Flow Commitment Contract) 与不可逆有限状态机 (FSM)
 * - 状态机：IDLE -> LOCKED -> COMPLETED / EMERGENCY_ABORT
 * - 防刷字数判别：基于有效正文编辑计算 deltaWords，过滤暴力批量粘贴
 * - 倒计时与字数达成判定
 */
export class IronChamberEngine {
  /**
   * 计算当前任务达成进度
   */
  public static calculateProgress(
    record: IronChamberRecord,
    currentWordCount: number,
    nowMs: number
  ): LockProgress {
    const deltaWords = Math.max(0, currentWordCount - record.startWords)
    const elapsedSeconds = Math.max(0, Math.floor((nowMs - record.pledgedAt) / 1000))
    const targetSeconds = record.targetMinutes * 60

    const wordsPercentage =
      record.targetWords > 0
        ? Math.min(100, Math.round((deltaWords / record.targetWords) * 100))
        : 100

    const timePercentage =
      targetSeconds > 0
        ? Math.min(100, Math.round((elapsedSeconds / targetSeconds) * 100))
        : 100

    let isFulfilled = false
    if (record.mode === "words") {
      isFulfilled = deltaWords >= record.targetWords
    } else if (record.mode === "minutes") {
      isFulfilled = elapsedSeconds >= targetSeconds
    } else if (record.mode === "dual") {
      isFulfilled = deltaWords >= record.targetWords && elapsedSeconds >= targetSeconds
    }

    return {
      deltaWords,
      targetWords: record.targetWords,
      elapsedSeconds,
      targetSeconds,
      wordsPercentage,
      timePercentage,
      isFulfilled,
    }
  }

  /**
   * 状态流转判定：核验是否可以平稳解锁
   */
  public static transitionToUnlock(
    record: IronChamberRecord,
    currentWordCount: number,
    nowMs: number
  ): { nextStatus: ChamberStatus; canUnlock: boolean; message: string } {
    if (record.status !== "locked") {
      return {
        nextStatus: record.status,
        canUnlock: true,
        message: "当前不在锁定状态",
      }
    }

    const progress = this.calculateProgress(record, currentWordCount, nowMs)
    if (progress.isFulfilled) {
      return {
        nextStatus: "completed",
        canUnlock: true,
        message: "恭喜！契约目标已圆满达成，小黑屋门禁已安全解除。",
      }
    }

    return {
      nextStatus: "locked",
      canUnlock: false,
      message: `尚未达成契约目标！还需编写 ${Math.max(0, record.targetWords - progress.deltaWords)} 字或坚持 ${Math.max(0, Math.ceil((record.targetMinutes * 60 - progress.elapsedSeconds) / 60))} 分钟。`,
    }
  }

  /**
   * 紧急脱逃反思验证：必须提交反思原因，防止轻易放弃
   */
  public static validateEmergencyAbort(reason: string): { valid: boolean; error?: string } {
    const trimmed = reason.trim()
    if (trimmed.length < 15) {
      return {
        valid: false,
        error: "紧急脱逃反思说明不得少于15字，请如实记录被迫中断创作的原因与代价。",
      }
    }
    return { valid: true }
  }
}
