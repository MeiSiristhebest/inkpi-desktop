/**
 * 唯一标识生成端口（抽象）。
 *
 * 把「生成记录主键」这一副作用从领域 / 用例层隔离出去，
 * 业务代码只调用 generate(prefix)，具体算法（时间基 / 随机 / UUID / 雪花）由适配器决定，
 * 测试可注入确定性实现，避免 Date.now() / Math.random() 泄漏到纯逻辑中。
 */
export interface IdGenerator {
  /** 生成带前缀的唯一标识，如 generate('ch') → 'ch-<base36时间>-<随机>' */
  generate(prefix: string): string
}
