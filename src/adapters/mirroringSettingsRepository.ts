import type { SettingsRepository } from '../ports/settingsRepository'

export type MirrorLogger = (message: string) => void

/**
 * 双写装饰器（§8.2，装饰器模式）：把「主存储即时写 + 镜像异步写」的持久化策略
 * 收敛到单一适配器，业务层（settings.tsx）完全无感知两段式写入。
 *
 * - 主存储（如 localStorage）失败时不影响镜像，镜像失败不影响主存储，失败仅记日志；
 * - load 优先读主存储，主存储为空时回退镜像并写回主存储，保证下次主存储命中。
 */
export const withMirror = (
  primary: SettingsRepository,
  mirror: SettingsRepository,
  logger: MirrorLogger = () => {},
): SettingsRepository => ({
  async load() {
    const fromPrimary = await primary.load()
    if (fromPrimary) return fromPrimary
    const fromMirror = await mirror.load()
    if (fromMirror) {
      await primary.save(fromMirror).catch((e) => logger(`mirror write-back failed: ${e}`))
    }
    return fromMirror
  },
  async save(settings) {
    await primary.save(settings).catch((e) => logger(`primary save failed: ${e}`))
    await mirror.save(settings).catch((e) => logger(`mirror save failed: ${e}`))
  },
})
