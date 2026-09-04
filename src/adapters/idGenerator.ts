import type { IdGenerator } from '../ports/idGenerator'

/**
 * 默认 ID 生成器：前缀 + 时间基 + 随机串。
 * 与历史 db.uid 算法保持一致以兼容既有数据；业务层通过端口注入，不直接依赖本文件。
 */
export const idGenerator: IdGenerator = {
  generate(prefix: string): string {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  },
}
