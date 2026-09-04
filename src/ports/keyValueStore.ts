/**
 * 键值存储端口（抽象）。
 *
 * 把「跨上下文的轻量持久化」（插件开关等）隔离为可注入依赖，
 * 业务层只调用 get / set，不感知底层是 localStorage、IndexedDB 还是远端配置中心。
 */
export interface KeyValueStore {
  /** 读取键对应的值；无记录时返回 null */
  get(key: string): Promise<string | null>
  /** 写入键值对 */
  set(key: string, value: string): Promise<void>
  /** 删除键（不存在时静默） */
  remove?(key: string): Promise<void>
}
