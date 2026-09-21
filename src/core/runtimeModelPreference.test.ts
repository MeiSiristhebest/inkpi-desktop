import { describe, it, expect, beforeEach } from 'vitest'
import {
  getRuntimeModelPreference,
  getRuntimeModelRoutes,
  setRuntimeModelPreference,
  setRuntimeModelRoutes,
} from './runtimeModelPreference'
import type { ModelConfig } from './settings'

describe('runtimeModelPreference — 用户选定模型 → Runtime modelRoute 快照', () => {
  beforeEach(() => {
    setRuntimeModelPreference(null)
    setRuntimeModelRoutes([], null)
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

  it('为 Runtime 构建启用模型路由与能力快照，禁用项不进入路由表', () => {
    const active: ModelConfig = {
      id: 'gpt-4o',
      name: 'GPT-4o',
      provider: 'openai',
      apiKey: 'sk-secret',
      baseUrl: 'https://api.openai.com/v1',
      contextWindow: 128000,
      maxTokens: 4096,
      supportsThinking: true,
      supportsImages: true,
    }
    const disabled: ModelConfig = {
      id: 'disabled',
      name: 'Disabled',
      provider: 'deepseek',
      enabled: false,
    }

    setRuntimeModelRoutes([active, disabled], active)

    expect(getRuntimeModelRoutes()).toMatchObject([
      {
        id: 'desktop:openai:gpt-4o',
        model: { id: 'gpt-4o', provider: 'openai', apiKey: 'sk-secret' },
        priority: 100,
        capabilities: {
          network: 'required',
          modalities: ['text', 'image'],
          contextTokens: 128000,
          maxOutputTokens: 4096,
          reasoning: true,
        },
      },
    ])
    expect(getRuntimeModelRoutes()).toHaveLength(1)
  })
})
