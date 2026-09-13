/**
 * modelCatalog.ts — 桌面端模型目录辅助层（手写代码，引用自动生成的快照）。
 *
 * 对齐参考实现的 "目录：内置快照 · N 个模型 · 更新于 X" 能力：
 *  - MODEL_CATALOG 快照由 scripts/generate-model-catalog.mjs 从
 *    inkpi 运行时（@inkpi/ai KNOWN_MODELS）生成，随仓库提交；
 *  - 本模块只放纯函数（展示格式化 / 快照查询）；刷新状态的持久化在
 *    src/adapters/localStorageCatalogMetaStore.ts（架构约束：core 层不得触碰 localStorage）。
 */
import {
  MODEL_CATALOG,
  MODEL_CATALOG_GENERATED_AT,
  lookupCatalogModel,
  type ModelCatalogSnapshot,
} from './modelCatalog.generated'

export { MODEL_CATALOG, MODEL_CATALOG_GENERATED_AT, lookupCatalogModel }
export type { ModelCatalogSnapshot }

/** "更新模型目录"（重新拉取各供应商端点模型列表）的上次执行状态 */
export interface CatalogMeta {
  fetchedAt?: string
  /** 本次刷新成功更新的供应商数 */
  fetchedCount?: number
  /** 本次刷新不可达的供应商数 */
  failedCount?: number
}

/** "更新于" 展示文案：从未执行过则显示「从未获取」（与参考实现一致） */
export function catalogUpdatedAtLabel(meta: CatalogMeta): string {
  if (!meta.fetchedAt) return '从未获取'
  const d = new Date(meta.fetchedAt)
  if (Number.isNaN(d.getTime())) return '从未获取'
  return d.toLocaleString('zh-CN', { hour12: false })
}

/** token 数紧凑格式化（对齐参考实现 formatTokenCount：K/M 缩写，缺失显示「—」） */
export function formatTokenCount(n?: number): string {
  if (n === undefined || n === null || n <= 0) return '—'
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return `${Number.isInteger(m) ? m : m.toFixed(1)}M`
  }
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return String(n)
}
