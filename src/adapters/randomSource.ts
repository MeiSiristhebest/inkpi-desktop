import type { RandomSource } from '../ports/randomSource'

/** 默认随机源：委托浏览器 Math.random。仅在基础设施层（adapters）使用。 */
export const randomSource: RandomSource = {
  next: () => Math.random(),
}
