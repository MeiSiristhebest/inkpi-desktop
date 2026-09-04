import type { CodexEntity } from '../plugins/living-codex/types'

/**
 * 世界观实体仓储端口（抽象）。
 *
 * 活体世界观（Codex）的增删查只依赖此端口，不直接接触 IndexedDB；
 * 适配器（本地 IndexedDB / 远端同步 / 测试内存版）实现该接口即可被注入。
 */
export interface CodexEntityRepository {
  getAll(): Promise<CodexEntity[]>
  save(entity: CodexEntity): Promise<void>
  delete(id: string): Promise<void>
}
