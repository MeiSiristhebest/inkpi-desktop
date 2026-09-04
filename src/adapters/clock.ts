import type { Clock } from '../ports/clock'

/** 默认时钟：直接委托系统时间。测试可注入返回固定值的实现。 */
export const clock: Clock = {
  now(): number {
    return Date.now()
  },
}
