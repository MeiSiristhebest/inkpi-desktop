/**
 * 随机源端口（DIP）。
 *
 * 视图 / 领域层不得直接调用 Math.random()，以便测试注入确定性随机源、
 * 保证可测性与纯函数性质。默认实现由 src/adapters/randomSource 提供。
 */
export interface RandomSource {
  /** 返回 [0, 1) 区间的随机浮点数，等价于 Math.random()。 */
  next(): number
}
