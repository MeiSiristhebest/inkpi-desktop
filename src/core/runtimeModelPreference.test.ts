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

  it('isolates identical ChatGPT models by account for route identity and preference', () => {
    const firstAccount: ModelConfig = {
      id: 'gpt-5.3-codex',
      name: 'GPT 5.3 Codex',
      provider: 'openai-chatgpt-plan',
      accountId: 'account-a',
    }
    const secondAccount: ModelConfig = { ...firstAccount, accountId: 'account-b' }

    setRuntimeModelRoutes([firstAccount, secondAccount], secondAccount)
    setRuntimeModelPreference(secondAccount)

    expect(getRuntimeModelRoutes()).toMatchObject([
      {
        id: 'desktop:openai-chatgpt-plan:gpt-5.3-codex:account:account-a',
        model: {
          id: 'gpt-5.3-codex',
          credentialRef: 'inkpi.model.openai-chatgpt-plan.account.account-a',
        },
        priority: 0,
      },
      {
        id: 'desktop:openai-chatgpt-plan:gpt-5.3-codex:account:account-b',
        model: {
          id: 'gpt-5.3-codex',
          credentialRef: 'inkpi.model.openai-chatgpt-plan.account.account-b',
        },
        priority: 100,
      },
    ])
    expect(getRuntimeModelPreference()).toEqual({
      providerId: 'openai-chatgpt-plan',
      modelId: 'gpt-5.3-codex',
      routeId: 'desktop:openai-chatgpt-plan:gpt-5.3-codex:account:account-b',
      required: true,
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
    const legacyChatGPTModel: ModelConfig = {
      id: 'legacy-model',
      name: 'Legacy model without account ownership',
      provider: 'openai-chatgpt-plan',
    }

    setRuntimeModelRoutes([active, disabled, legacyChatGPTModel], active)

    expect(getRuntimeModelRoutes()).toMatchObject([
      {
        id: 'desktop:openai:gpt-4o',
        model: {
          id: 'gpt-4o',
          provider: 'openai',
          credentialRef: 'inkpi.model.openai.gpt-4o',
        },
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
    expect(JSON.stringify(getRuntimeModelRoutes())).not.toContain('apiKey')
    expect(JSON.stringify(getRuntimeModelRoutes())).not.toContain('sk-secret')
    expect(getRuntimeModelRoutes()).toHaveLength(1)
  })
})
