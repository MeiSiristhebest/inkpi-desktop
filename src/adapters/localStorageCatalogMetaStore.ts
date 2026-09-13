/**
 * localStorageCatalogMetaStore.ts — 模型目录刷新状态的 localStorage 适配器。
 *
 * 架构约束（src/architecture.test.ts）：src/core 不得直接触碰 localStorage，
 * 基础设施层的同步键值存取统一放在 src/adapters 中。
 */
import type { CatalogMeta } from '../core/modelCatalog'

const CATALOG_META_KEY = 'inkpi-ai-catalog-meta'

/** 读取"更新模型目录"的上次执行状态（同步：供组件初始 state 使用） */
export function readCatalogMeta(): CatalogMeta {
  try {
    const raw = localStorage.getItem(CATALOG_META_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Partial<CatalogMeta>
    return {
      fetchedAt: typeof parsed.fetchedAt === 'string' ? parsed.fetchedAt : undefined,
      fetchedCount: typeof parsed.fetchedCount === 'number' ? parsed.fetchedCount : undefined,
      failedCount: typeof parsed.failedCount === 'number' ? parsed.failedCount : undefined,
    }
  } catch {
    return {}
  }
}

/** 持久化"更新模型目录"的执行状态 */
export function writeCatalogMeta(meta: CatalogMeta): void {
  try {
    localStorage.setItem(CATALOG_META_KEY, JSON.stringify(meta))
  } catch {
    // 存储不可用时静默降级
  }
}
