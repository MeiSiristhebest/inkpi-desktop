import type { ModelConfig } from './settings'

/**
 * 用户“选择哪个模型驱动 Runtime”的运行时偏好快照。
 *
 * 与 Secret 存义分离：SecretStore 只负责把 API Key 安全存好；这里是运行时路由
 * 的“最后一步”——把用户当前选定的模型（provider/model id）注入到发往 Daemon 的
 * AiTask.metadata.modelRoute，让 Runtime 的 model-capability-router 据此选择真实
 * 模型。偏好通过已可序列化的 metadata 传输，不改协议 schema，与 pinned runtime
 * contract（inkpi.runtime.v1 / schema 24b37c12）兼容。
 */
export interface RuntimeModelPreference {
  providerId: string
  modelId: string
}

let current: RuntimeModelPreference | undefined

/** 由 Settings Provider 在 aiModel 变化时同步。null/undefined 清除偏好（回退到 Runtime 默认）。 */
export function setRuntimeModelPreference(model: ModelConfig | null | undefined): void {
  if (!model || !model.provider || !model.id) {
    current = undefined
    return
  }
  current = { providerId: model.provider, modelId: model.id }
}

/** 读取当前选定的模型偏好（供 adapter / task 构建器附加到 metadata.modelRoute）。 */
export function getRuntimeModelPreference(): RuntimeModelPreference | undefined {
  return current
}
