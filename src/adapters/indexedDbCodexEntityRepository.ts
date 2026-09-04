import { db } from '../db/indexedDB'
import type { CodexEntity } from '../plugins/living-codex/types'
import type { CodexEntityRepository } from '../ports/codexEntityRepository'

/**
 * IndexedDB 世界观实体仓储适配器：把端口方法映射到 inkpi-studio 的 codexEntities 表。
 * 这是唯一直接接触 IndexedDB 实现细节的地方；视图层不会直接 import db。
 */
export const indexedDbCodexEntityRepository: CodexEntityRepository = {
  getAll: () => db.getAll<CodexEntity>('codexEntities'),
  save: (entity) => db.put('codexEntities', entity),
  delete: (id) => db.delete('codexEntities', id),
}
