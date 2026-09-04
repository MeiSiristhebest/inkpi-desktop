// 心流极速码字冲刺引擎
// 滑动窗口 WPM 实时流、指数平滑算法与 Combo 心流热度阶梯

import type { FlowStateLevel } from '../types'

export class SprintEngine {
  /**
   * 根据字符增量与时间差计算瞬时 WPM（Words Per Minute）
   */
  public calculateWpm(charsDelta: number, secondsDelta: number): number {
    if (secondsDelta <= 0 || charsDelta <= 0) return 0
    const wpm = (charsDelta / secondsDelta) * 60
    return Math.round(wpm)
  }

  /**
   * 指数移动平均平滑（Exponential Moving Average）
   * 抑制单次击键或标点停顿带来的离散剧烈抖动
   */
  public smoothWpm(prevEma: number, currentInstantWpm: number, alpha = 0.3): number {
    if (prevEma <= 0) return currentInstantWpm
    return Math.round(alpha * currentInstantWpm + (1 - alpha) * prevEma)
  }

  /**
   * 判定心流热度等级
   */
  public determineFlowLevel(comboCount: number, wpm: number): FlowStateLevel {
    if (comboCount <= 0) return 'idle'
    if (comboCount >= 60 && wpm >= 75) return 'zen_mode'
    if (comboCount >= 30 && wpm >= 55) return 'flow_surge'
    if (comboCount >= 10 && wpm >= 25) return 'focused'
    return 'warm_up'
  }

  /**
   * 判定连击是否保持
   * 连续输入间隔 <= 3.5 秒视为保持连击
   */
  public isComboSustained(nowMs: number, lastKeyMs: number, maxGapMs = 3500): boolean {
    if (lastKeyMs <= 0) return true
    return nowMs - lastKeyMs <= maxGapMs
  }
}

export const sprintEngine = new SprintEngine()
