import { describe, it, expect, beforeEach } from 'vitest'
import { getRuntimeModelPreference, setRuntimeModelPreference } from './runtimeModelPreference'
import type { ModelConfig } from './settings'

describe('runtimeModelPreference — 用户选定模型 → Runtime modelRoute 快照', () => {
  beforeEach(() => {
    setRuntimeModelPreference(null)
  })

  it('从选定的 ModelConfig 生成 provider/model 偏好快照', () => {
    const cfg: ModelConfig = {
      id: 'deepseek-v3',
      name: 'DeepSeek V3',
      provider: 'deepseek',
    }
    setRuntimeModelPreference(cfg)
    expect(getRuntimeModelPreference()).toEqual({
      providerId: 'deepseek',
      modelId: 'deepseek-v3',
    })
  })

  it('null / 缺字段时清除偏好（回退 Runtime 默认路由）', () => {
    setRuntimeModelPreference(null)
    expect(getRuntimeModelPreference()).toBeUndefined()
    setRuntimeModelPreference({ id: '', name: '', provider: 'deepseek' })
    expect(getRuntimeModelPreference()).toBeUndefined()
  })

  it('不含任何 API 密钥，只携带 provider/model 标识', () => {
    setRuntimeModelPreference({
      id: 'gpt-4o',
      name: 'GPT-4o',
      provider: 'openai',
      apiKey: 'sk-secret',
    })
    const pref = getRuntimeModelPreference()
    expect(pref).toEqual({ providerId: 'openai', modelId: 'gpt-4o' })
    expect(JSON.stringify(pref)).not.toContain('sk-secret')
  })
})
