import type { ChamberStatus, IronChamberRecord, LockProgress } from '../types'

/** Counts chapter length changes and elapsed time. It cannot classify editing intent. */
export class IronChamberEngine {
  public static countCharacters(text: string): number {
    return Array.from(text.replace(/\s/g, '')).length
  }
  /**
   * 计算当前任务达成进度
   */
  public static calculateProgress(
    record: IronChamberRecord,
    currentWordCount: number,
    nowMs: number,
  ): LockProgress {
    const nonnegativeInteger = (value: number) => Number.isSafeInteger(value) && value >= 0
    const valid =
      ['words', 'minutes', 'dual'].includes(record.mode) &&
      [
        record.startWords,
        record.targetWords,
        record.targetMinutes,
        currentWordCount,
        record.pledgedAt,
        nowMs,
      ].every(nonnegativeInteger) &&
      nowMs >= record.pledgedAt &&
      (record.mode === 'minutes' || record.targetWords > 0) &&
      (record.mode === 'words' || record.targetMinutes > 0) &&
      Number.isSafeInteger(record.targetMinutes * 60)
    if (!valid)
      return {
        valid: false,
        error: '目标、计数或时间无效，未判定达标；仍可自愿结束。',
        deltaWords: 0,
        targetWords: 0,
        elapsedSeconds: 0,
        targetSeconds: 0,
        wordsPercentage: 0,
        timePercentage: 0,
        isFulfilled: false,
      }
    const deltaWords = Math.max(0, currentWordCount - record.startWords)
    const elapsedSeconds = Math.max(0, Math.floor((nowMs - record.pledgedAt) / 1000))
    const targetSeconds = record.targetMinutes * 60

    const wordsPercentage =
      record.targetWords > 0
        ? Math.min(100, Math.round((deltaWords / record.targetWords) * 100))
        : 100

    const timePercentage =
      targetSeconds > 0 ? Math.min(100, Math.round((elapsedSeconds / targetSeconds) * 100)) : 100

    let isFulfilled = false
    if (record.mode === 'words') {
      isFulfilled = deltaWords >= record.targetWords
    } else if (record.mode === 'minutes') {
      isFulfilled = elapsedSeconds >= targetSeconds
    } else if (record.mode === 'dual') {
      isFulfilled = deltaWords >= record.targetWords && elapsedSeconds >= targetSeconds
    }

    return {
      valid: true,
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
    nowMs: number,
  ): { nextStatus: ChamberStatus; canUnlock: boolean; message: string } {
    if (record.status !== 'locked') {
      return {
        nextStatus: record.status,
        canUnlock: true,
        message: '当前不在锁定状态',
      }
    }

    const progress = this.calculateProgress(record, currentWordCount, nowMs)
    if (progress.isFulfilled) {
      return {
        nextStatus: 'completed',
        canUnlock: true,
        message: '目标已达成，可以保存为完成。',
      }
    }

    return {
      nextStatus: 'locked',
      canUnlock: false,
      message: progress.error ?? '尚未达成所选目标；可以继续，也可以自愿结束。',
    }
  }

  /**
   * Voluntary termination does not require an explanation.
   */
  public static validateEmergencyAbort(_reason: string): { valid: boolean; error?: string } {
    return { valid: true }
  }
}
